import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { getFleetAppByName } from '#server/data/fleet-registry'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await enforceRateLimit(event, 'fleet-posthog', 30, 60_000)

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

  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 30)

  // Time filter and app filter sharing
  const timeAndAppFilter = `
    WHERE timestamp >= '${start.toISOString().slice(0, 19)}'
      AND timestamp <= '${end.toISOString().slice(0, 19)}'
      AND properties.app = '${app.name.replaceAll("'", "\\'")}'
  `

  // Query for summary
  const summaryQuery = `
    SELECT count() AS event_count,
           count(DISTINCT distinct_id) AS unique_users,
           countIf(event = '$pageview') AS pageviews,
           count(DISTINCT properties.$session_id) AS sessions
    FROM events
    ${timeAndAppFilter}
  `

  // Query for time series (daily pageviews)
  const timeSeriesQuery = `
    SELECT toDate(timestamp) AS date,
           countIf(event = '$pageview') AS pageviews
    FROM events
    ${timeAndAppFilter}
    GROUP BY date
    ORDER BY date ASC
  `

  // Query for Top Pages
  const topPagesQuery = `
    SELECT properties.$pathname AS path,
           count() AS count
    FROM events
    ${timeAndAppFilter}
      AND event = '$pageview'
      AND properties.$pathname IS NOT NULL
    GROUP BY path
    ORDER BY count DESC
    LIMIT 10
  `

  // Query for Top Referrers
  const topReferrersQuery = `
    SELECT properties.$referrer AS referrer,
           count() AS count
    FROM events
    ${timeAndAppFilter}
      AND event = '$pageview'
      AND properties.$referrer IS NOT NULL
      AND properties.$referrer != ''
    GROUP BY referrer
    ORDER BY count DESC
    LIMIT 10
  `

  // Query for Countries
  const topCountriesQuery = `
    SELECT properties.$geoip_country_code AS country,
           count(DISTINCT distinct_id) AS users
    FROM events
    ${timeAndAppFilter}
      AND properties.$geoip_country_code IS NOT NULL
    GROUP BY country
    ORDER BY users DESC
    LIMIT 10
  `

  // Query for Browsers
  const topBrowsersQuery = `
    SELECT properties.$browser AS browser,
           count(DISTINCT distinct_id) AS users
    FROM events
    ${timeAndAppFilter}
      AND properties.$browser IS NOT NULL
    GROUP BY browser
    ORDER BY users DESC
    LIMIT 10
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

    const [summaryRes, timeSeriesRes, pagesRes, referRes, countriesRes, browsersRes] = await Promise.all([
      fetchHogQL(summaryQuery),
      fetchHogQL(timeSeriesQuery),
      fetchHogQL(topPagesQuery),
      fetchHogQL(topReferrersQuery),
      fetchHogQL(topCountriesQuery),
      fetchHogQL(topBrowsersQuery)
    ])

    const checkRes = async <T>(res: Response, name: string): Promise<T> => {
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`PostHog API ${name} ${res.status}: ${text}`)
      }
      return res.json() as Promise<T>
    }

    type HogQLResult = { columns?: string[], results?: (string | number | null)[][] }

    const [summaryData, timeSeriesData, pagesData, referData, countriesData, browsersData] = await Promise.all([
      checkRes<HogQLResult>(summaryRes, 'Summary'),
      checkRes<HogQLResult>(timeSeriesRes, 'TimeSeries'),
      checkRes<HogQLResult>(pagesRes, 'TopPages'),
      checkRes<HogQLResult>(referRes, 'TopReferrers'),
      checkRes<HogQLResult>(countriesRes, 'TopCountries'),
      checkRes<HogQLResult>(browsersRes, 'TopBrowsers')
    ])

    const summaryRow = summaryData.results?.[0] ?? []
    const summaryCols = summaryData.columns ?? ['event_count', 'unique_users', 'pageviews', 'sessions']

    // Map HogQL array results to an object using columns
    const summary = summaryCols.reduce((acc: Record<string, number>, col: string, idx: number) => {
      acc[col] = Number(summaryRow[idx] ?? 0)
      return acc
    }, {} as Record<string, number>)

    // Parse the results: [[dateString, count], ...]
    const timeSeries = (timeSeriesData.results ?? []).map((row: (string | number | null)[]) => ({
      date: String(row[0]),
      value: Number(row[1] ?? 0)
    }))

    const topPages = (pagesData.results ?? []).map((row: (string | number | null)[]) => ({
      name: String(row[0] || '/'),
      count: Number(row[1] ?? 0)
    }))

    const topReferrers = (referData.results ?? []).map((row: (string | number | null)[]) => ({
      name: String(row[0] || 'Direct'),
      count: Number(row[1] ?? 0)
    }))

    const topCountries = (countriesData.results ?? []).map((row: (string | number | null)[]) => ({
      name: String(row[0] || 'Unknown'),
      count: Number(row[1] ?? 0)
    }))

    const topBrowsers = (browsersData.results ?? []).map((row: (string | number | null)[]) => ({
      name: String(row[0] || 'Unknown'),
      count: Number(row[1] ?? 0)
    }))

    // Direct link to session replays in PostHog for this app filter
    // Note: This requires knowing the PostHog UI host, assuming app.posthog.com if us or eu
    const uiHost = host.includes('us.i.posthog.com') ? 'https://us.posthog.com' : 'https://eu.posthog.com'
    const replaysUrl = `${uiHost}/project/${projectId}/replays?properties=[{"key":"app","value":["${encodeURIComponent(app.name)}"],"operator":"exact","type":"event"}]`

    return {
      app: app.name,
      summary,
      timeSeries,
      topPages,
      topReferrers,
      topCountries,
      topBrowsers,
      replaysUrl,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10)
    }
  } catch (err: unknown) {
    const e = err as { message?: string }
    throw createError({ statusCode: 500, message: `PostHog error: ${e.message ?? 'Unknown'}` })
  }
})
