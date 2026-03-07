import { z } from 'zod'
import { getRequestHeaders, getRequestURL } from 'h3'
import { getFleetApps } from '#server/data/fleet-registry'
import { withD1Cache } from '#layer/server/utils/d1Cache'

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
  /** Wall-clock deadline so we never exceed Cloudflare Worker limits (522). Return partial results when hit. */
  const DEADLINE_MS = 22_000
  const BATCH_SIZE = 4

  const result = await withD1Cache(
    event,
    cacheKey,
    TTL,
    async () => {
      const apps = await getFleetApps(event)
      // Use forwarded auth headers so Nitro's in-process $fetch passes them
      // to sub-endpoint handlers (requireAdmin reads cookies from the internal request).
      const headers = getRequestHeaders(event)
      const authHeaders: Record<string, string> = {}
      if (headers.cookie) authHeaders.cookie = headers.cookie
      if (headers.authorization) authHeaders.authorization = headers.authorization
      if (headers['x-requested-with']) authHeaders['x-requested-with'] = headers['x-requested-with']
      // Forward cron secret so sub-endpoints can bypass requireAdmin
      if (cronHeader) authHeaders['x-internal-cron'] = cronHeader

      // Use the request origin for external fetch — internal $fetch on Cloudflare Workers
      // does NOT propagate event.context.cloudflare (D1 bindings), causing 500s.
      // External fetch goes through Workers runtime which injects bindings properly.
      const origin = getRequestURL(event).origin

      const summaryMap: Record<string, FleetAppAnalyticsSummary> = {}
      const start = Date.now()

      /** Helper: fetch a sub-endpoint via real HTTP and return parsed JSON or null. */
      async function safeFetch<T>(path: string, query: Record<string, string>): Promise<T | null> {
        try {
          const qs = new URLSearchParams(query).toString()
          const res = await fetch(`${origin}${path}?${qs}`, { headers: authHeaders })
          if (!res.ok) {
            console.error(`[Fleet Analytics] ${path} → ${res.status}`)
            return null
          }
          return (await res.json()) as T
        } catch (err) {
          console.error(`[Fleet Analytics] ${path} error:`, (err as Error).message)
          return null
        }
      }

      for (let i = 0; i < apps.length; i += BATCH_SIZE) {
        if (Date.now() - start > DEADLINE_MS) break
        const batch = apps.slice(i, i + BATCH_SIZE)
        const settled = await Promise.allSettled(
          // eslint-disable-next-line nuxt-guardrails/no-map-async-in-server -- intentional: batched with Promise.allSettled and deadline
          batch.map(async (app) => {
            const [ga, gsc, posthog] = await Promise.all([
              safeFetch<{
                summary?: unknown
                deltas?: unknown
                timeSeries?: { date: string; value: number }[]
              }>(`/api/fleet/ga/${encodeURIComponent(app.name)}`, { startDate, endDate }),
              safeFetch<{ totals?: unknown; rows?: unknown[] }>(
                `/api/fleet/gsc/${encodeURIComponent(app.name)}`,
                { startDate, endDate, dimension: 'query' },
              ),
              safeFetch<{
                summary?: Record<string, number>
                timeSeries?: { date: string; value: number }[]
              }>(`/api/fleet/posthog/${encodeURIComponent(app.name)}`, { startDate, endDate }),
            ])

            const out: FleetAppAnalyticsSummary = {
              ga: ga
                ? {
                    summary: ga.summary as FleetAppAnalyticsSummary['ga'] extends {
                      summary: infer S
                    }
                      ? S
                      : never,
                    deltas: (ga.deltas ?? null) as FleetAppAnalyticsSummary['ga'] extends {
                      deltas: infer D
                    }
                      ? D
                      : null,
                    timeSeries: ga.timeSeries ?? [],
                  }
                : null,
              gsc: gsc
                ? {
                    totals: (gsc.totals ?? null) as FleetAppAnalyticsSummary['gsc'] extends {
                      totals: infer T
                    }
                      ? T
                      : null,
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
        for (const p of settled) {
          if (p.status === 'fulfilled' && p.value) {
            const { appName, ga, gsc, posthog } = p.value
            summaryMap[appName] = { ga, gsc, posthog }
          }
        }
      }

      return { apps: summaryMap, startDate, endDate }
    },
    parsed.force === 'true',
    { staleWindowSeconds: TTL, returnMeta: true },
  )

  return result
})
