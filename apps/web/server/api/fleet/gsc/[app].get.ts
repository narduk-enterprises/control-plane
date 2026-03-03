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

  const hostname = new URL(app.url).hostname
  const gscSiteUrl = `sc-domain:${hostname}`

  try {
    const data = (await googleApiFetch(
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
    )) as Record<string, unknown>

    const rows = (data.rows as Array<Record<string, unknown>>) ?? []
    return { app: app.name, rows, startDate, endDate, dimension: query.dimension }
  } catch (err: unknown) {
    const e = err as { message?: string }
    const msg = e.message ?? 'Unknown'
    // Map common GSC failures to clearer messages
    if (msg.includes('403')) {
      throw createError({
        statusCode: 403,
        message: `GSC: Site not verified or service account not added. Add sc-domain:${hostname} in Search Console and grant analytics-admin@narduk-analytics.iam.gserviceaccount.com owner access.`,
      })
    }
    if (msg.includes('404')) {
      throw createError({
        statusCode: 404,
        message: `GSC: Site sc-domain:${hostname} not found. Add and verify the property in Google Search Console.`,
      })
    }
    throw createError({ statusCode: 500, message: `GSC error: ${msg}` })
  }
})
