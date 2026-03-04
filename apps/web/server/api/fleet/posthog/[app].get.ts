import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { getFleetAppByName } from '#server/data/fleet-registry'
import { z } from 'zod'

const CACHE_TTL_SECONDS = 60 // 1 minute

function getD1(event: Parameters<Parameters<typeof defineEventHandler>[0]>[0]) {
  return (event.context.cloudflare?.env as { DB?: D1Database })?.DB ?? null
}

async function ensureCacheTable(db: D1Database) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS kv_cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `)
}

async function getCached(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT value FROM kv_cache WHERE key = ? AND expires_at > ?')
    .bind(key, Math.floor(Date.now() / 1000))
    .first<{ value: string }>()
  return row?.value ?? null
}

async function setCache(db: D1Database, key: string, value: string, ttlSeconds: number) {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds
  await db
    .prepare('INSERT OR REPLACE INTO kv_cache (key, value, expires_at) VALUES (?, ?, ?)')
    .bind(key, value, expiresAt)
    .run()
}

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
        'PostHog not configured: set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID in the control plane\'s Doppler (prd), e.g. from the narduk-nuxt-template Doppler project.',
    })
  }

  const queryParams = await getValidatedQuery(event, z.object({
    summaryOnly: z.enum(['true', 'false']).optional(),
    force: z.enum(['true', 'false']).optional()
  }).parse)

  const isSummaryOnly = queryParams.summaryOnly === 'true'
  const isForce = queryParams.force === 'true'

  const cacheKey = `posthog-app-${appSlug}-${isSummaryOnly ? 'summary' : 'full'}`
  const d1 = getD1(event)

  // Try D1 cache if not forcing
  if (d1 && !isForce) {
    try {
      await ensureCacheTable(d1)
      const cached = await getCached(d1, cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch {
      // Non-critical
    }
  }

  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 30)

  const timeAndAppFilter = `
    WHERE timestamp >= '${start.toISOString().slice(0, 19)}'
      AND timestamp <= '${end.toISOString().slice(0, 19)}'
      AND properties.app = '${app.name.replaceAll("'", "\\'")}'
  `

  const summaryQuery = `
    SELECT count() AS event_count,
           count(DISTINCT distinct_id) AS unique_users,
           countIf(event = '$pageview') AS pageviews,
           count(DISTINCT properties.$session_id) AS sessions
    FROM events
    ${timeAndAppFilter}
  `

  const timeSeriesQuery = `
    SELECT toDate(timestamp) AS date, countIf(event = '$pageview') AS pageviews
    FROM events ${timeAndAppFilter} GROUP BY date ORDER BY date ASC
  `

  const topPagesQuery = `
    SELECT properties.$pathname AS path, count() AS count
    FROM events ${timeAndAppFilter} AND event = '$pageview' AND properties.$pathname IS NOT NULL
    GROUP BY path ORDER BY count DESC LIMIT 10
  `

  const topReferrersQuery = `
    SELECT properties.$referrer AS referrer, count() AS count
    FROM events ${timeAndAppFilter} AND event = '$pageview' AND properties.$referrer IS NOT NULL AND properties.$referrer != ''
    GROUP BY referrer ORDER BY count DESC LIMIT 10
  `

  const topCountriesQuery = `
    SELECT properties.$geoip_country_code AS country, count(DISTINCT distinct_id) AS users
    FROM events ${timeAndAppFilter} AND properties.$geoip_country_code IS NOT NULL
    GROUP BY country ORDER BY users DESC LIMIT 10
  `

  const topBrowsersQuery = `
    SELECT properties.$browser AS browser, count(DISTINCT distinct_id) AS users
    FROM events ${timeAndAppFilter} AND properties.$browser IS NOT NULL
    GROUP BY browser ORDER BY users DESC LIMIT 10
  `

  try {
    const fetchHogQL = (q: string) => fetch(`${host.replace(/\/$/, '')}/api/projects/${projectId}/query/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query: q } }),
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
      const [summaryRes, timeSeriesRes, pagesRes, referRes, countriesRes, browsersRes] = await Promise.all([
        fetchHogQL(summaryQuery),
        fetchHogQL(timeSeriesQuery),
        fetchHogQL(topPagesQuery),
        fetchHogQL(topReferrersQuery),
        fetchHogQL(topCountriesQuery),
        fetchHogQL(topBrowsersQuery),
      ])

      const [summaryData, timeSeriesData, pagesData, referData, countriesData, browsersData] = await Promise.all([
        checkRes<HogQLResult>(summaryRes, 'Summary'),
        checkRes<HogQLResult>(timeSeriesRes, 'TimeSeries'),
        checkRes<HogQLResult>(pagesRes, 'TopPages'),
        checkRes<HogQLResult>(referRes, 'TopReferrers'),
        checkRes<HogQLResult>(countriesRes, 'TopCountries'),
        checkRes<HogQLResult>(browsersRes, 'TopBrowsers'),
      ])

      const summaryRow = summaryData.results?.[0] ?? []
      const summaryCols = summaryData.columns ?? ['event_count', 'unique_users', 'pageviews', 'sessions']
      const summary = summaryCols.reduce((acc: Record<string, number>, col: string, idx: number) => {
        acc[col] = Number(summaryRow[idx] ?? 0)
        return acc
      }, {} as Record<string, number>)

      const timeSeries = (timeSeriesData.results ?? []).map(row => ({ date: String(row[0]), value: Number(row[1] ?? 0) }))
      const topPages = (pagesData.results ?? []).map(row => ({ name: String(row[0] || '/'), count: Number(row[1] ?? 0) }))
      const topReferrers = (referData.results ?? []).map(row => ({ name: String(row[0] || 'Direct'), count: Number(row[1] ?? 0) }))
      const topCountries = (countriesData.results ?? []).map(row => ({ name: String(row[0] || 'Unknown'), count: Number(row[1] ?? 0) }))
      const topBrowsers = (browsersData.results ?? []).map(row => ({ name: String(row[0] || 'Unknown'), count: Number(row[1] ?? 0) }))

      const uiHost = host.includes('us.i.posthog.com') ? 'https://us.posthog.com' : 'https://eu.posthog.com'
      const replaysUrl = `${uiHost}/project/${projectId}/replays?properties=[{"key":"app","value":["${encodeURIComponent(app.name)}"],"operator":"exact","type":"event"}]`

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


    if (d1) {
      try {
        await setCache(d1, cacheKey, JSON.stringify(payload), CACHE_TTL_SECONDS)
      } catch {
        // Non-critical
      }
    }

    return payload
  } catch (err: unknown) {
    const e = err as { message?: string }
    throw createError({ statusCode: 500, message: `PostHog error: ${e.message ?? 'Unknown'}` })
  }
})

