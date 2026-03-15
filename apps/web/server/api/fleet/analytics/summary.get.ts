import { z } from 'zod'
import { getFleetApps } from '#server/data/fleet-registry'
import { getD1CacheDB, withD1Cache } from '#layer/server/utils/d1Cache'

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

      const summaryMap: Record<string, FleetAppAnalyticsSummary> = {}

      if (db) {
        // BATCH READ: Build all expected exact cache keys upfront and read in a single query.
        // This replaces the old N+1 approach (3 queries per app × N apps = up to 60 queries).
        const keyToApp = new Map<string, { slug: string; provider: 'ga' | 'gsc' | 'posthog' }>()
        for (const app of apps) {
          const slug = app.name
          keyToApp.set(`ga-app-${slug}-${startDate}-${endDate}`, { slug, provider: 'ga' })
          keyToApp.set(`gsc-app-${slug}-${startDate}-${endDate}-query`, { slug, provider: 'gsc' })
          // PostHog keys include 'full' or 'summary' mode plus ISO timestamps.
          // Use a prefix match for PostHog since the exact key format varies.
          keyToApp.set(`posthog-app-${slug}-full-${startDate}`, { slug, provider: 'posthog' })
        }

        // Initialize all apps with null data
        for (const app of apps) {
          summaryMap[app.name] = { ga: null, gsc: null, posthog: null }
        }

        try {
          // Batch exact-key reads: single query with IN clause for GA + GSC keys
          const exactKeys = [...keyToApp.keys()].filter((k) => !k.startsWith('posthog-'))
          if (exactKeys.length > 0) {
            const placeholders = exactKeys.map(() => '?').join(', ')
            const rows = await db
              .prepare(`SELECT key, value FROM kv_cache WHERE key IN (${placeholders})`)
              .bind(...exactKeys)
              .all<{ key: string; value: string }>()

            for (const row of rows.results ?? []) {
              const mapping = keyToApp.get(row.key)
              if (!mapping) continue
              try {
                const data = JSON.parse(row.value)
                if (mapping.provider === 'ga') {
                  summaryMap[mapping.slug]!.ga = {
                    summary: data.summary ?? null,
                    deltas: data.deltas ?? null,
                    timeSeries: data.timeSeries ?? [],
                  }
                } else if (mapping.provider === 'gsc') {
                  summaryMap[mapping.slug]!.gsc = {
                    totals: data.totals ?? null,
                    rowsCount: data.rows?.length ?? 0,
                  }
                }
              } catch (parseErr) {
                console.error(
                  `[Analytics Summary] Failed to parse cached ${mapping.provider} data for ${mapping.slug}:`,
                  parseErr,
                )
              }
            }
          }

          // PostHog: batch read with LIKE prefix matching (keys include ISO timestamps that vary)
          // Single query with OR conditions instead of per-app LIKE queries
          const phSlugs = apps.map((a) => a.name)
          if (phSlugs.length > 0) {
            const phConditions = phSlugs.map(() => 'key LIKE ?').join(' OR ')
            const phBinds = phSlugs.map((slug) => `posthog-app-${slug}-%`)
            // Use a subquery to get the latest entry per app prefix
            const phRows = await db
              .prepare(
                `SELECT key, value FROM kv_cache WHERE (${phConditions}) ORDER BY expires_at DESC`,
              )
              .bind(...phBinds)
              .all<{ key: string; value: string }>()

            // Dedupe: only take the first (most recent) entry per slug
            const seenSlugs = new Set<string>()
            for (const row of phRows.results ?? []) {
              // Extract slug from key format: posthog-app-{slug}-{mode}-{timestamp}
              const match = row.key.match(/^posthog-app-(.+?)-(full|summary)-/)
              if (!match) continue
              const slug = match[1]!
              if (seenSlugs.has(slug)) continue
              seenSlugs.add(slug)

              try {
                const data = JSON.parse(row.value)
                summaryMap[slug]!.posthog = {
                  summary: data.summary ?? {},
                  timeSeries: data.timeSeries ?? [],
                }
              } catch (parseErr) {
                console.error(
                  `[Analytics Summary] Failed to parse cached PostHog data for ${slug}:`,
                  parseErr,
                )
              }
            }
          }
        } catch (dbErr) {
          console.error('[Analytics Summary] D1 batch read failed:', dbErr)
          // Fall through with whatever data we have (all nulls is better than 500)
        }
      } else {
        // No D1 — initialize all as null
        for (const app of apps) {
          summaryMap[app.name] = { ga: null, gsc: null, posthog: null }
        }
      }

      return { apps: summaryMap, startDate, endDate }
    },
    parsed.force === 'true',
    { staleWindowSeconds: TTL, returnMeta: true },
  )

  return result
})
