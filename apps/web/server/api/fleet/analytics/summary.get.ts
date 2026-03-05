import { z } from 'zod'
import { getRequestURL, getRequestHeaders } from 'h3'
import { getFleetApps } from '#server/data/fleet-registry'
import { withD1Cache } from '#server/utils/d1-cache'

const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  force: z.enum(['true', 'false']).optional(),
})

export interface FleetAppAnalyticsSummary {
  ga: {
    summary: { activeUsers?: number; screenPageViews?: number; sessions?: number } | null
    deltas: { users?: number; pageviews?: number; sessions?: number } | null
    timeSeries: { date: string; value: number }[]
  } | null
  gsc: {
    totals: { clicks?: number; impressions?: number; ctr?: number; position?: number } | null
    rowsCount: number
  } | null
  posthog: {
    summary: Record<string, number>
    timeSeries: { date: string; value: number }[]
  } | null
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const cronHeader = getHeader(event, 'x-internal-cron')
  if (!(config.cronSecret && cronHeader === config.cronSecret)) {
    await requireAdmin(event)
  }
  await enforceRateLimit(event, 'fleet-analytics-summary', 20, 60_000)

  const query = querySchema.safeParse(getQuery(event))
  const parsed = query.success ? query.data : {}
  let endDate = parsed.endDate ?? new Date().toISOString().split('T')[0] ?? ''
  const startObj = new Date(endDate)
  startObj.setDate(startObj.getDate() - 30)
  let startDate = parsed.startDate ?? startObj.toISOString().split('T')[0] ?? ''
  if (startDate > endDate) {
    const t = startDate
    startDate = endDate
    endDate = t
  }

  const cacheKey = `fleet-analytics-summary-${startDate}-${endDate}`
  const TTL = 30 * 60
  const result = await withD1Cache(
    event,
    cacheKey,
    TTL,
    async () => {
      const apps = await getFleetApps(event)
      const baseURL = getRequestURL(event).origin
      const headers = getRequestHeaders(event)
      const authHeaders: Record<string, string> = {}
      if (headers.cookie) authHeaders.cookie = headers.cookie
      if (headers.authorization) authHeaders.authorization = headers.authorization
      if (headers['x-requested-with']) authHeaders['x-requested-with'] = headers['x-requested-with']

      const settled = await Promise.allSettled(
        apps.map(async (app) => {
          const [gaRes, gscRes, posthogRes] = await Promise.allSettled([
            $fetch<{ summary?: unknown; deltas?: unknown; timeSeries?: { date: string; value: number }[] }>(
              `/api/fleet/ga/${encodeURIComponent(app.name)}`,
              {
                baseURL,
                headers: authHeaders,
                query: { startDate, endDate },
              },
            ).catch(() => null),
            $fetch<{ totals?: unknown; rows?: unknown[] }>(`/api/fleet/gsc/${encodeURIComponent(app.name)}`, {
              baseURL,
              headers: authHeaders,
              query: { startDate, endDate, dimension: 'query' },
            }).catch(() => null),
            $fetch<{ summary?: Record<string, number>; timeSeries?: { date: string; value: number }[] }>(
              `/api/fleet/posthog/${encodeURIComponent(app.name)}`,
              {
                baseURL,
                headers: authHeaders,
                query: { startDate, endDate },
              },
            ).catch(() => null),
          ])

          const ga = gaRes.status === 'fulfilled' && gaRes.value ? gaRes.value : null
          const gsc = gscRes.status === 'fulfilled' && gscRes.value ? gscRes.value : null
          const posthog = posthogRes.status === 'fulfilled' && posthogRes.value ? posthogRes.value : null

          const out: FleetAppAnalyticsSummary = {
            ga: ga
              ? {
                  summary: ga.summary as FleetAppAnalyticsSummary['ga'] extends { summary: infer S } ? S : never,
                  deltas: (ga.deltas ?? null) as FleetAppAnalyticsSummary['ga'] extends { deltas: infer D } ? D : null,
                  timeSeries: ga.timeSeries ?? [],
                }
              : null,
            gsc: gsc
              ? {
                  totals: (gsc.totals ?? null) as FleetAppAnalyticsSummary['gsc'] extends { totals: infer T } ? T : null,
                  rowsCount: gsc.rows?.length ?? 0,
                }
              : null,
            posthog: posthog
              ? { summary: posthog.summary ?? {}, timeSeries: posthog.timeSeries ?? [] }
              : null,
          }
          return { appName: app.name, ...out }
        }),
      )

      const summaryMap: Record<string, FleetAppAnalyticsSummary> = {}
      for (const p of settled) {
        if (p.status === 'fulfilled' && p.value) {
          const { appName, ga, gsc, posthog } = p.value
          summaryMap[appName] = { ga, gsc, posthog }
        }
      }
      return { apps: summaryMap, startDate, endDate }
    },
    parsed.force === 'true',
    { staleWindowSeconds: TTL, returnMeta: true },
  )

  return result
})
