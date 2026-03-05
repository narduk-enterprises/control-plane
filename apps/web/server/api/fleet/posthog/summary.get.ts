import { z } from 'zod'
import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'

import { withD1Cache } from '#server/utils/d1-cache'

const CACHE_TTL_SECONDS = 60 // 1 minute

export default defineEventHandler(async (event) => {
    await requireAdmin(event)
    await enforceRateLimit(event, 'fleet-posthog-summary', 30, 60_000)

    const queryParams = await getValidatedQuery(event, z.object({
        force: z.enum(['true', 'false']).optional(),
    }).parse)

    return withD1Cache(event, 'posthog-summary', CACHE_TTL_SECONDS, async () => {

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
    SELECT properties.app AS app_name,
           count() AS event_count,
           count(DISTINCT distinct_id) AS unique_users
    FROM events
    WHERE timestamp >= '${start.toISOString().slice(0, 19)}'
      AND timestamp <= '${end.toISOString().slice(0, 19)}'
      AND properties.app IS NOT NULL
    GROUP BY app_name
    ORDER BY event_count DESC
  `

        try {
            const res = await fetch(`${host.replace(/\/$/, '')}/api/projects/${projectId}/query/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({ query: { kind: 'HogQLQuery', query: hogqlQuery } }),
            })

            if (!res.ok) {
                const text = await res.text()
                console.error(`[PostHog Summary] API error ${res.status}:`, text)
                throw new Error(`PostHog API ${res.status}: ${text}`)
            }

            type HogQLResult = { results?: (string | number | null)[][] }
            const data = (await res.json()) as HogQLResult

            const result: Record<string, { eventCount: number; users: number }> = {}
            for (const row of data.results ?? []) {
                const appName = String(row[0] ?? '')
                if (appName) {
                    result[appName] = {
                        eventCount: Number(row[1] ?? 0),
                        users: Number(row[2] ?? 0),
                    }
                }
            }

            return result
        } catch (err: unknown) {
            const e = err as { message?: string }
            console.error('[PostHog Summary] Error:', e.message)
            throw createError({ statusCode: 500, message: `PostHog summary error: ${e.message ?? 'Unknown'}` })
        }
    }, queryParams.force === 'true')
})
