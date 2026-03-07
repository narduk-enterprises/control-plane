import { z } from 'zod'
import { getFleetApps } from '#server/data/fleet-registry'
import { getD1CacheDB, getCached, withD1Cache } from '#layer/server/utils/d1Cache'

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
      const db = getD1CacheDB(event)

      // Read sub-endpoint cached data directly from D1 instead of internal $fetch.
      // Cloudflare Workers internal $fetch does NOT propagate event.context.cloudflare
      // (D1 bindings), causing 500s. External fetch to the same Worker domain also
      // doesn't work due to Cloudflare's same-zone bypass restriction.
      const summaryMap: Record<string, FleetAppAnalyticsSummary> = {}

      for (const app of apps) {
        const slug = app.name
        let ga: FleetAppAnalyticsSummary['ga'] = null
        let gsc: FleetAppAnalyticsSummary['gsc'] = null
        let posthog: FleetAppAnalyticsSummary['posthog'] = null

        if (db) {
          try {
            // Try exact key first, fall back to most recent cache entry for this app.
            // Date ranges vary by timezone/timing, so fuzzy matching prevents silent nulls.
            const gaCache = await getCached(db, `ga-app-${slug}-${startDate}-${endDate}`)
            const gaRow = gaCache
              ?? await db.prepare(`SELECT value FROM kv_cache WHERE key LIKE ? ORDER BY expires_at DESC LIMIT 1`)
                .bind(`ga-app-${slug}-%`).first<{ value: string }>()
            if (gaRow) {
              const gaData = JSON.parse('value' in gaRow ? gaRow.value : (gaRow as { value: string }).value)
              ga = {
                summary: gaData.summary ?? null,
                deltas: gaData.deltas ?? null,
                timeSeries: gaData.timeSeries ?? [],
              }
            }
          } catch {
            /* skip */
          }

          try {
            const gscCache = await getCached(db, `gsc-app-${slug}-${startDate}-${endDate}-query`)
            const gscRow = gscCache
              ?? await db.prepare(`SELECT value FROM kv_cache WHERE key LIKE ? ORDER BY expires_at DESC LIMIT 1`)
                .bind(`gsc-app-${slug}-%`).first<{ value: string }>()
            if (gscRow) {
              const gscData = JSON.parse('value' in gscRow ? gscRow.value : (gscRow as { value: string }).value)
              gsc = {
                totals: gscData.totals ?? null,
                rowsCount: gscData.rows?.length ?? 0,
              }
            }
          } catch {
            /* skip */
          }

          try {
            const phRow = await db
              .prepare(
                `SELECT value FROM kv_cache WHERE key LIKE ? ORDER BY expires_at DESC LIMIT 1`,
              )
              .bind(`posthog-app-${slug}-%`)
              .first<{ value: string }>()
            if (phRow) {
              const phData = JSON.parse(phRow.value)
              posthog = {
                summary: phData.summary ?? {},
                timeSeries: phData.timeSeries ?? [],
              }
            }
          } catch {
            /* skip */
          }
        }

        summaryMap[slug] = { ga, gsc, posthog }
      }

      return { apps: summaryMap, startDate, endDate }
    },
    parsed.force === 'true',
    { staleWindowSeconds: TTL, returnMeta: true },
  )

  return result
})
