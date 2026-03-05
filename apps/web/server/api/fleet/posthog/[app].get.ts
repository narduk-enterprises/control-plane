import { z } from 'zod'
import { getFleetAppByName } from '#server/data/fleet-registry'

import { withD1Cache } from '#server/utils/d1-cache'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await enforceRateLimit(event, 'fleet-posthog', 100, 60_000)

  const appSlug = getRouterParam(event, 'app')
  if (!appSlug) throw createError({ statusCode: 400, message: 'Missing app' })

  const app = getFleetAppByName(appSlug)
  if (!app) throw createError({ statusCode: 404, message: 'App not found' })

  const config = useRuntimeConfig()
  const apiKey = config.posthogApiKey as string
  const projectId = config.posthogProjectId as string
  const host = (config.posthogHost as string) || 'https://us.i.posthog.com'

  if (!apiKey || !projectId) {
    throw createError({
      statusCode: 503,
      message:
        'PostHog not configured: set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID in the control plane\'s Doppler (prd).',
    })
  }

  const queryParams = await getValidatedQuery(event, z.object({
    summaryOnly: z.enum(['true', 'false']).optional(),
    force: z.enum(['true', 'false']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).parse)

  const isSummaryOnly = queryParams.summaryOnly === 'true'

  let end = queryParams.endDate ? new Date(queryParams.endDate) : new Date()
  // Ensure 'end' spans the entire day if provided without a specific time (e.g. YYYY-MM-DD from presets)
  if (queryParams.endDate && !queryParams.endDate.includes('T')) {
    end.setUTCHours(23, 59, 59, 999)
  }

  let start = queryParams.startDate
    ? new Date(queryParams.startDate)
    : new Date(end.getTime()) // Default: today only

  // Prevent crashes from Vue reactivity tearing where start evaluates after end
  if (start.getTime() > end.getTime()) {
    const temp = start
    start = end
    end = temp
  }

  const cacheKey = `posthog-app-${appSlug}-${isSummaryOnly ? 'summary' : 'full'}-${start.toISOString().slice(0, 19)}-${end.toISOString().slice(0, 19)}`

  return withD1Cache(event, cacheKey, 3600, async () => {

    const posthogName = app.posthogAppName ?? app.name
    const escapedApp = posthogName.replaceAll("'", "\\'")
    const startISO = start.toISOString().slice(0, 19)
    const endISO = end.toISOString().slice(0, 19)

    const timeAndAppFilter = `
    WHERE timestamp >= '${startISO}'
      AND timestamp <= '${endISO}'
      AND properties.app = '${escapedApp}'
  `

    // OPTIMIZED: Combined summary + time series into a single query
    const summaryQuery = `
    SELECT count() AS event_count,
           count(DISTINCT distinct_id) AS unique_users,
           countIf(event = '$pageview') AS pageviews,
           count(DISTINCT properties.$session_id) AS sessions
    FROM events
    ${timeAndAppFilter}
  `

    try {
      const fetchHogQL = (q: string) => fetch(`${host.replace(/\/$/, '')}/api/projects/${projectId}/query/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ query: { kind: 'HogQLQuery', query: q } }),
        signal: AbortSignal.timeout(15_000),
      })

      const checkRes = async <T>(res: Response, name: string): Promise<T> => {
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`PostHog API ${name} ${res.status}: ${text}`)
        }
        return res.json() as Promise<T>
      }

      type HogQLResult = { columns?: string[], results?: (string | number | null)[][] }

      interface PostHogPayload {
        app: string
        summary: Record<string, number>
        timeSeries?: { date: string; value: number }[]
        topPages?: { name: string; count: number }[]
        topReferrers?: { name: string; count: number }[]
        topCountries?: { name: string; count: number }[]
        topBrowsers?: { name: string; count: number }[]
        replaysUrl?: string
        startDate: string
        endDate: string
      }

      let payload: PostHogPayload

      if (isSummaryOnly) {
        const summaryRes = await fetchHogQL(summaryQuery)
        const summaryData = await checkRes<HogQLResult>(summaryRes, 'Summary')
        const summaryRow = summaryData.results?.[0] ?? []
        const summaryCols = summaryData.columns ?? ['event_count', 'unique_users', 'pageviews', 'sessions']
        const summary = summaryCols.reduce((acc: Record<string, number>, col: string, idx: number) => {
          acc[col] = Number(summaryRow[idx] ?? 0)
          return acc
        }, {} as Record<string, number>)

        payload = {
          app: app.name,
          summary,
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
        }
      }
      else {
        // OPTIMIZED: 3 queries instead of 6
        // Query 1: Summary stats
        // Query 2: Time series
        // Query 3: Batch all top-N dimensions

        const timeSeriesQuery = `
        SELECT toDate(timestamp) AS date, countIf(event = '$pageview') AS pageviews
        FROM events ${timeAndAppFilter} GROUP BY date ORDER BY date ASC
      `

        // BATCHED: All top-N queries combined via UNION ALL
        const batchedTopQuery = `
        SELECT 'page' AS dimension, properties.$pathname AS name, count() AS cnt
        FROM events ${timeAndAppFilter} AND event = '$pageview' AND properties.$pathname IS NOT NULL
        GROUP BY name ORDER BY cnt DESC LIMIT 10

        UNION ALL

        SELECT 'referrer' AS dimension, properties.$referrer AS name, count() AS cnt
        FROM events ${timeAndAppFilter} AND event = '$pageview' AND properties.$referrer IS NOT NULL AND properties.$referrer != ''
        GROUP BY name ORDER BY cnt DESC LIMIT 10

        UNION ALL

        SELECT 'country' AS dimension, properties.$geoip_country_code AS name, count(DISTINCT distinct_id) AS cnt
        FROM events ${timeAndAppFilter} AND properties.$geoip_country_code IS NOT NULL
        GROUP BY name ORDER BY cnt DESC LIMIT 10

        UNION ALL

        SELECT 'browser' AS dimension, properties.$browser AS name, count(DISTINCT distinct_id) AS cnt
        FROM events ${timeAndAppFilter} AND properties.$browser IS NOT NULL
        GROUP BY name ORDER BY cnt DESC LIMIT 10
      `

        const [summaryRes, timeSeriesRes, batchedRes] = await Promise.all([
          fetchHogQL(summaryQuery),
          fetchHogQL(timeSeriesQuery),
          fetchHogQL(batchedTopQuery),
        ])

        const [summaryData, timeSeriesData, batchedData] = await Promise.all([
          checkRes<HogQLResult>(summaryRes, 'Summary'),
          checkRes<HogQLResult>(timeSeriesRes, 'TimeSeries'),
          checkRes<HogQLResult>(batchedRes, 'BatchedTop'),
        ])

        const summaryRow = summaryData.results?.[0] ?? []
        const summaryCols = summaryData.columns ?? ['event_count', 'unique_users', 'pageviews', 'sessions']
        const summary = summaryCols.reduce((acc: Record<string, number>, col: string, idx: number) => {
          acc[col] = Number(summaryRow[idx] ?? 0)
          return acc
        }, {} as Record<string, number>)

        const timeSeries = (timeSeriesData.results ?? []).map(row => ({ date: String(row[0]), value: Number(row[1] ?? 0) }))

        // Parse batched results by dimension
        const batchedRows = batchedData.results ?? []
        const topPages = batchedRows.filter(r => r[0] === 'page').map(r => ({ name: String(r[1] || '/'), count: Number(r[2] ?? 0) }))
        const topReferrers = batchedRows.filter(r => r[0] === 'referrer').map(r => ({ name: String(r[1] || 'Direct'), count: Number(r[2] ?? 0) }))
        const topCountries = batchedRows.filter(r => r[0] === 'country').map(r => ({ name: String(r[1] || 'Unknown'), count: Number(r[2] ?? 0) }))
        const topBrowsers = batchedRows.filter(r => r[0] === 'browser').map(r => ({ name: String(r[1] || 'Unknown'), count: Number(r[2] ?? 0) }))

        const uiHost = host.includes('us.i.posthog.com') ? 'https://us.posthog.com' : 'https://eu.posthog.com'
        const replaysUrl = `${uiHost}/project/${projectId}/replays?properties=[{"key":"app","value":["${encodeURIComponent(posthogName)}"],"operator":"exact","type":"event"}]`

        payload = {
          app: app.name,
          summary,
          timeSeries,
          topPages,
          topReferrers,
          topCountries,
          topBrowsers,
          replaysUrl,
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
        }
      }

      return payload
    } catch (err: unknown) {
      const e = err as { message?: string }
      throw createError({ statusCode: 500, message: `PostHog error: ${e.message ?? 'Unknown'}` })
    }
  }, queryParams.force === 'true')
})
