import { z } from 'zod'
import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { withD1Cache } from '#layer/server/utils/d1Cache'
import { getFleetApps } from '#server/data/fleet-registry'

const CACHE_TTL_SECONDS = 5 * 60 // 5 min
const STALE_WINDOW_SECONDS = 5 * 60 // 5 min

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await enforceRateLimit(event, 'fleet-posthog-summary', 30, 60_000)

  const queryParams = await getValidatedQuery(
    event,
    z.object({
      force: z.enum(['true', 'false']).optional(),
    }).parse,
  )

  // Fetch all fleet apps to map URLs to appNames before hitting cache or PostHog
  // Doing it here outside cache logic or inside? Inside is better to keep the function pure and isolated.
  return withD1Cache(
    event,
    'posthog-summary',
    CACHE_TTL_SECONDS,
    async () => {
      const allApps = await getFleetApps(event)
      const hostToAppMap = new Map<string, string>()
      for (const app of allApps) {
        if (!app.url) continue
        try {
          const u = new URL(app.url)
          hostToAppMap.set(u.hostname, app.name)
        } catch (err) {
          console.warn('[PostHog Summary] Invalid app URL parsing host:', app.url)
        }
      }

      const config = useRuntimeConfig()
      const apiKey = config.posthogApiKey as string
      const projectId = config.posthogProjectId as string
      const host = (config.posthogHost as string) || 'https://us.i.posthog.com'

      if (!apiKey || !projectId) {
        throw createError({
          statusCode: 503,
          message: 'PostHog not configured',
        })
      }

      const end = new Date()
      const start = new Date(end)
      start.setDate(start.getDate() - 30)

      const hogqlQuery = `
    SELECT properties.$host AS app_host,
           count() AS pageviews,
           count(DISTINCT distinct_id) AS unique_users,
           count(DISTINCT properties.$session_id) AS sessions
    FROM events
    WHERE timestamp >= '${start.toISOString().slice(0, 19)}'
      AND timestamp <= '${end.toISOString().slice(0, 19)}'
      AND event = '$pageview'
      AND properties.$host IS NOT NULL
      AND properties.$host NOT LIKE '%localhost%'
      AND properties.$host NOT LIKE '%.local%'
    GROUP BY app_host
    ORDER BY pageviews DESC
  `

      try {
        const apiUrl = `${host.replace(/\/$/, '')}/api/projects/${projectId}/query/`
        if (import.meta.dev)
          console.log(
            `[PostHog Summary Request] ${apiUrl}\n  Query: ${hogqlQuery.trim().replaceAll(/\s+/g, ' ').slice(0, 200)}`,
          )
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ query: { kind: 'HogQLQuery', query: hogqlQuery } }),
          signal: AbortSignal.timeout(25_000),
        })

        if (!res.ok) {
          const text = await res.text()
          console.error(`[PostHog Summary] API error ${res.status}:`, text)
          throw new Error(`PostHog API ${res.status}: ${text}`)
        }

        type HogQLResult = { results?: (string | number | null)[][] }
        const data = (await res.json()) as HogQLResult
        if (import.meta.dev)
          console.log(`[PostHog Summary Response] ${data.results?.length ?? 0} app hosts returned`)

        const result: Record<
          string,
          { eventCount: number; users: number; pageviews: number; sessions: number }
        > = {}
        for (const row of data.results ?? []) {
          const appHost = String(row[0] ?? '')
          const appName = hostToAppMap.get(appHost)

          if (appName) {
            const pageviews = Number(row[1] ?? 0)

            // If multiple host names map to the same app, accumulate them.
            if (!result[appName]) {
              result[appName] = {
                eventCount: pageviews,
                users: Number(row[2] ?? 0),
                pageviews: pageviews,
                sessions: Number(row[3] ?? 0),
              }
            } else {
              result[appName].eventCount += pageviews
              result[appName].users += Number(row[2] ?? 0)
              result[appName].pageviews += pageviews
              result[appName].sessions += Number(row[3] ?? 0)
            }
          }
        }
        return result
      } catch (err: unknown) {
        const e = err as { message?: string }
        console.error('[PostHog Summary] Error:', e.message)
        throw createError({
          statusCode: 500,
          message: `PostHog summary error: ${e.message ?? 'Unknown'}`,
        })
      }
    },
    queryParams.force === 'true',
    { staleWindowSeconds: STALE_WINDOW_SECONDS },
  )
})
