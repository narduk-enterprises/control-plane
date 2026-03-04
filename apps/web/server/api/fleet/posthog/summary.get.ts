import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'

const CACHE_TTL_SECONDS = 60 // 1 minute

/**
 * Get the raw D1 binding (bypasses Drizzle — we just need a simple KV cache).
 */
function getD1(event: Parameters<Parameters<typeof defineEventHandler>[0]>[0]) {
    return (event.context.cloudflare?.env as { DB?: D1Database })?.DB ?? null
}

/**
 * Auto-create the kv_cache table if it doesn't exist.
 */
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
    await enforceRateLimit(event, 'fleet-posthog-summary', 30, 60_000)

    const d1 = getD1(event)

    // Try D1 cache first
    if (d1) {
        try {
            await ensureCacheTable(d1)
            const cached = await getCached(d1, 'posthog-summary')
            if (cached) {
                return JSON.parse(cached)
            }
        } catch {
            // D1 cache miss or error — proceed to fetch
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

        // Persist to D1 cache
        if (d1) {
            try {
                await setCache(d1, 'posthog-summary', JSON.stringify(result), CACHE_TTL_SECONDS)
            } catch {
                // Non-critical — in-memory still works
            }
        }

        return result
    } catch (err: unknown) {
        const e = err as { message?: string }
        console.error('[PostHog Summary] Error:', e.message)
        throw createError({ statusCode: 500, message: `PostHog summary error: ${e.message ?? 'Unknown'}` })
    }
})
