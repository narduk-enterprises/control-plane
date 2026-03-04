import type { H3Event } from 'h3'

export function getD1CacheDB(event: H3Event) {
    return (event.context.cloudflare?.env as { DB?: D1Database })?.DB ?? null
}



export async function getCached(db: D1Database, key: string): Promise<string | null> {
    const row = await db
        .prepare('SELECT value FROM kv_cache WHERE key = ? AND expires_at > ?')
        .bind(key, Math.floor(Date.now() / 1000))
        .first<{ value: string }>()
    return row?.value ?? null
}

export async function setCache(db: D1Database, key: string, value: string, ttlSeconds: number) {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds
    await db
        .prepare('INSERT OR REPLACE INTO kv_cache (key, value, expires_at) VALUES (?, ?, ?)')
        .bind(key, value, expiresAt)
        .run()
}

/**
 * Wraps an async fetcher with D1 KV caching.
 * Falls back to executing the fetcher if D1 is unavailable or errors out.
 */
export async function withD1Cache<T>(
    event: H3Event,
    cacheKey: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
    isForce = false,
): Promise<T> {
    const d1 = getD1CacheDB(event)

    // Try D1 cache first
    if (d1 && !isForce) {
        try {
            const cached = await getCached(d1, cacheKey)
            if (cached) {
                console.log(`[D1 Cache HIT] ${cacheKey}`)
                return JSON.parse(cached) as T
            }
            console.log(`[D1 Cache MISS] ${cacheKey}`)
        } catch (err) {
            console.error(`[D1 Cache GET Error] ${cacheKey}`, err)
        }
    } else if (!d1) {
        console.warn(`[D1 Cache] DB binding not found for ${cacheKey}`)
    }

    // Execute the actual logic
    const result = await fetcher()

    // Background persist to D1 cache
    if (d1 && result !== undefined) {
        try {
            await setCache(d1, cacheKey, JSON.stringify(result), ttlSeconds)
            console.log(`[D1 Cache SET] ${cacheKey}`)
        } catch (err) {
            console.error(`[D1 Cache SET Error] ${cacheKey}`, err)
        }
    }

    return result
}
