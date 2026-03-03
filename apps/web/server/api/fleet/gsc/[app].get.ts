import { z } from 'zod'
import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { googleApiFetch, GSC_SCOPES } from '#layer/server/utils/google'
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

  console.log(`[fleet-gsc] Querying for app: ${appSlug}, siteUrl: ${app.url}`)
  // GSC URL-prefix properties typically do not have a trailing slash in the API identifier
  const gscSiteUrl = app.url.replace(/\/$/, '')
  console.log(`[fleet-gsc] Normalized siteUrl for GSC API: ${gscSiteUrl}`)

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
      ).catch((err) => {
        console.error('GSC Dimensional Query Error:', err)
        throw err // Re-throw to be caught by the outer catch
      }),

      // 2. Aggregate Totals Query
      googleApiFetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`,
        GSC_SCOPES,
        {
          method: 'POST',
          body: JSON.stringify({
            startDate,
            endDate,
            // no dimensions = aggregate totals
            rowLimit: 1,
          }),
        },
      ).catch((err) => {
        console.error('GSC Totals Query Error:', err)
        return null // Graceful failure for totals
      }),

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
      ).catch((err) => {
        console.error('GSC Inspection API Error:', err)
        return null // Graceful failure for inspection data
      })
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
    const e = err as { message?: string }
    const msg = e.message ?? 'Unknown'
    if (msg.includes('GSC_SERVICE_ACCOUNT_JSON not configured')) {
      throw createError({
        statusCode: 503,
        message: 'GSC not configured: set GSC_SERVICE_ACCOUNT_JSON in Doppler',
      })
    }
    if (msg.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') || msg.includes('insufficient authentication scopes')) {
      throw createError({
        statusCode: 403,
        message: `GSC: Token scope mismatch. The cached token may not include webmasters scope. This is an internal bug — please retry.`,
      })
    }
    if (msg.includes('403') && msg.includes('insufficientPermissions')) {
      throw createError({
        statusCode: 403,
        message: `GSC: Service account lacks permission. Add sc-domain:${new URL(gscSiteUrl).hostname} (or ${gscSiteUrl}) in Search Console and grant analytics-admin@narduk-analytics.iam.gserviceaccount.com owner access.`,
      })
    }
    if (msg.includes('403')) {
      throw createError({
        statusCode: 403,
        message: `GSC: Site not verified or service account not added. Add sc-domain:${new URL(gscSiteUrl).hostname} (or ${gscSiteUrl}) in Search Console and grant analytics-admin@narduk-analytics.iam.gserviceaccount.com owner access.`,
      })
    }
    if (msg.includes('404')) {
      throw createError({
        statusCode: 404,
        message: `GSC: Site ${gscSiteUrl} not found. Add and verify the property in Google Search Console.`,
      })
    }
    throw createError({ statusCode: 500, message: `GSC error: ${msg}` })
  }
})
