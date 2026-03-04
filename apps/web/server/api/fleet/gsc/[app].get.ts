import { z } from 'zod'
import { GoogleApiError, googleApiFetch, GSC_SCOPES } from '#layer/server/utils/google'
import { getFleetAppByName } from '#server/data/fleet-registry'

const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  dimension: z
    .enum(['query', 'page', 'device', 'country', 'searchAppearance'])
    .optional()
    .default('query'),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await enforceRateLimit(event, 'fleet-gsc', 30, 60_000)

  const appSlug = getRouterParam(event, 'app')
  if (!appSlug) throw createError({ statusCode: 400, message: 'Missing app' })

  const app = getFleetAppByName(appSlug)
  if (!app) throw createError({ statusCode: 404, message: 'App not found' })

  const parsed = querySchema.safeParse(getQuery(event))
  const query = parsed.success ? parsed.data : { dimension: 'query' as const }
  const endDate = query.endDate ?? new Date().toISOString().split('T')[0] ?? ''
  const start = new Date(endDate)
  start.setDate(start.getDate() - 30)
  const startDate = query.startDate ?? start.toISOString().split('T')[0] ?? ''

  // GSC site URL: use sc-domain: prefix for domain-level properties
  // (this is how setup-analytics.ts registers sites via the Webmasters API)
  const hostname = new URL(app.url).hostname
  const gscSiteUrl = `sc-domain:${hostname}`

  try {
    const [dimensionalData, totalData, inspectionData] = await Promise.all([
      // 1. Dimensional Query
      googleApiFetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`,
        GSC_SCOPES,
        {
          method: 'POST',
          body: JSON.stringify({
            startDate,
            endDate,
            dimensions: [query.dimension],
            rowLimit: 50,
          }),
        },
      ),

      // 2. Aggregate Totals Query
      googleApiFetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`,
        GSC_SCOPES,
        {
          method: 'POST',
          body: JSON.stringify({
            startDate,
            endDate,
            rowLimit: 1,
          }),
        },
      ).catch(() => null),

      // 3. URL Inspection API
      googleApiFetch(
        `https://searchconsole.googleapis.com/v1/urlInspection/index:inspect`,
        GSC_SCOPES,
        {
          method: 'POST',
          body: JSON.stringify({
            inspectionUrl: app.url,
            siteUrl: gscSiteUrl,
            languageCode: 'en-US',
          }),
        },
      ).catch(() => null)
    ])

    const data = dimensionalData as Record<string, unknown>
    const rows = (data.rows as Array<Record<string, unknown>>) ?? []

    const totalsObj = totalData as Record<string, unknown> | null
    const totalsRow = (totalsObj?.rows as Array<Record<string, unknown>>)?.[0] || null

    const inspectionObj = inspectionData as Record<string, unknown> | null
    const inspectionResult = inspectionObj?.inspectionResult as Record<string, unknown> | undefined

    return {
      app: app.name,
      rows,
      totals: totalsRow,
      inspection: inspectionResult,
      startDate,
      endDate,
      dimension: query.dimension
    }
  } catch (err: unknown) {
    if (err instanceof GoogleApiError) {
      if (err.status === 403) {
        throw createError({
          statusCode: 403,
          message: `GSC: Permission denied for site '${gscSiteUrl}'. Ensure analytics-admin@narduk-analytics.iam.gserviceaccount.com has access in Google Search Console.`,
          data: err.body
        })
      }
      if (err.status === 404) {
        throw createError({
          statusCode: 404,
          message: `GSC: Site '${gscSiteUrl}' not found in Search Console.`,
          data: err.body
        })
      }
    }
    throw err
  }
})
