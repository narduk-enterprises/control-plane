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
        'PostHog not configured: set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID in the control plane\'s Doppler (prd), e.g. from narduk-analytics hub.',
    })
  }

  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 30)
  const query = `
    SELECT count() AS event_count,
           count(DISTINCT distinct_id) AS unique_users
    FROM events
    WHERE timestamp >= '${start.toISOString().slice(0, 19)}'
      AND timestamp <= '${end.toISOString().slice(0, 19)}'
      AND properties.app = '${app.name.replaceAll("'", "\\'")}'
  `

  try {
    const res = await fetch(`${host.replace(/\/$/, '')}/api/projects/${projectId}/query/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`PostHog API ${res.status}: ${text}`)
    }

    const data = (await res.json()) as { results?: unknown[] }
    return { app: app.name, summary: data.results?.[0] ?? {}, startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
  } catch (err: unknown) {
    const e = err as { message?: string }
    throw createError({ statusCode: 500, message: `PostHog error: ${e.message ?? 'Unknown'}` })
  }
})
