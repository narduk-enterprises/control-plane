import { z } from 'zod'
import { GoogleApiError, googleApiFetch, GSC_SCOPES } from '#layer/server/utils/google'
import { getFleetAppByName } from '#server/data/fleet-registry'
import { withD1Cache } from '#server/utils/d1-cache'

const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  dimension: z
    .enum(['query', 'page', 'device', 'country', 'searchAppearance'])
    .optional()
    .default('query'),
  force: z.enum(['true', 'false']).optional(),
})

/** Try a GSC query against a siteUrl, return null on 403/404 */
async function tryGscQuery(siteUrl: string, startDate: string, endDate: string, dimension: string) {
  const encoded = encodeURIComponent(siteUrl)
  try {
    const [dimensionalData, totalData] = await Promise.all([
      googleApiFetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`,
        GSC_SCOPES,
        {
          method: 'POST',
          body: JSON.stringify({ startDate, endDate, dimensions: [dimension], rowLimit: 50 }),
        },
      ),
      googleApiFetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`,
        GSC_SCOPES,
        {
          method: 'POST',
          body: JSON.stringify({ startDate, endDate, rowLimit: 1 }),
        },
      ).catch(() => null),
    ])
    return { dimensionalData, totalData, siteUrl }
  } catch (err: unknown) {
    if (err instanceof GoogleApiError && (err.status === 403 || err.status === 404)) {
      return null // signal to try fallback
    }
    throw err
  }
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await enforceRateLimit(event, 'fleet-gsc', 30, 60_000)

  const appSlug = getRouterParam(event, 'app')
  if (!appSlug) throw createError({ statusCode: 400, message: 'Missing app' })

  const app = await getFleetAppByName(event, appSlug)
  if (!app) throw createError({ statusCode: 404, message: 'App not found' })

  const parsed = querySchema.safeParse(getQuery(event))
  const query = parsed.success ? parsed.data : { dimension: 'query' as const }
  let endDate = query.endDate ?? new Date().toISOString().split('T')[0] ?? ''
  const startObj = new Date(endDate)
  startObj.setDate(startObj.getDate() - 30)
  let startDate = query.startDate ?? startObj.toISOString().split('T')[0] ?? ''

  // Prevent crashes from Vue reactivity tearing where start evaluates after end
  if (startDate > endDate) {
    const temp = startDate
    startDate = endDate
    endDate = temp
  }

  // Standard: sc-domain: (domain-level property)
  // Fallback: URL-prefix (https://domain/) for legacy properties
  const hostname = new URL(app.url).hostname
  const scDomain = `sc-domain:${hostname}`
  const urlPrefix = `${app.url.replace(/\/$/, '')}/`

  const cacheKey = `gsc-app-${appSlug}-${startDate}-${endDate}-${query.dimension}`
  const TTL = 4 * 3600
  const staleWindow = 2 * 3600

  return withD1Cache(event, cacheKey, TTL, async () => {
    // Try sc-domain first, fall back to URL-prefix
    let result = await tryGscQuery(scDomain, startDate, endDate, query.dimension)
    const usedFallback = !result
    if (!result) {
      result = await tryGscQuery(urlPrefix, startDate, endDate, query.dimension)
    }

    if (!result) {
      throw createError({
        statusCode: 403,
        message: `GSC: No access for '${scDomain}' or '${urlPrefix}'. Grant analytics-admin@narduk-analytics.iam.gserviceaccount.com access in Google Search Console.`,
      })
    }

    const data = result.dimensionalData as Record<string, unknown>
    const rows = (data.rows as Array<Record<string, unknown>>) ?? []

    const totalsObj = result.totalData as Record<string, unknown> | null
    const totalsRow = (totalsObj?.rows as Array<Record<string, unknown>>)?.[0] || null

    // URL Inspection (best-effort, uses whichever siteUrl worked)
    let inspectionResult: Record<string, unknown> | undefined
    try {
      const inspectionData = await googleApiFetch(
        `https://searchconsole.googleapis.com/v1/urlInspection/index:inspect`,
        GSC_SCOPES,
        {
          method: 'POST',
          body: JSON.stringify({
            inspectionUrl: app.url,
            siteUrl: result.siteUrl,
            languageCode: 'en-US',
          }),
        },
      ) as Record<string, unknown>
      inspectionResult = inspectionData.inspectionResult as Record<string, unknown> | undefined
    } catch { /* best-effort */ }

    return {
      app: app.name,
      rows,
      totals: totalsRow,
      inspection: inspectionResult,
      startDate,
      endDate,
      dimension: query.dimension,
      ...(usedFallback ? { gscSiteUrl: result.siteUrl, note: 'Used URL-prefix fallback (not sc-domain)' } : {}),
    }
  }, query.force === 'true', { staleWindowSeconds: staleWindow })
})

