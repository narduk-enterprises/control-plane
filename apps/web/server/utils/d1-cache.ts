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

export interface D1CacheMeta {
    cachedAt: string
    stale: boolean
}

export interface WithD1CacheOptions {
    /** If set, return cached data when expired but within this many seconds of expiry, and refresh in background */
    staleWindowSeconds?: number
    /** If true, return value is wrapped as { data: T, _meta: D1CacheMeta } */
    returnMeta?: boolean
}

/**
 * Wraps an async fetcher with D1 KV caching.
 * Falls back to executing the fetcher if D1 is unavailable or errors out.
 * Optional: stale-while-revalidate and _meta (cachedAt, stale) for progressive loading.
 */
export async function withD1Cache<T>(
    event: H3Event,
    cacheKey: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
    isForce?: boolean,
    options?: WithD1CacheOptions & { returnMeta?: false },
): Promise<T>
export async function withD1Cache<T>(
    event: H3Event,
    cacheKey: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
    isForce: boolean,
    options: WithD1CacheOptions & { returnMeta: true },
): Promise<{ data: T; _meta: D1CacheMeta }>
export async function withD1Cache<T>(
    event: H3Event,
    cacheKey: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
    isForce = false,
    options: WithD1CacheOptions = {},
): Promise<T | { data: T; _meta: D1CacheMeta }> {
    const { staleWindowSeconds = 0, returnMeta = false } = options
    const d1 = getD1CacheDB(event)
    const nowSec = Math.floor(Date.now() / 1000)

    const wrap = (data: T, stale: boolean): T | { data: T; _meta: D1CacheMeta } => {
        if (!returnMeta) return data
        return {
            data,
            _meta: { cachedAt: new Date().toISOString(), stale },
        }
    }

    // Try D1 cache first
    if (d1 && !isForce) {
        try {
            const row = await d1
                .prepare('SELECT value, expires_at FROM kv_cache WHERE key = ?')
                .bind(cacheKey)
                .first<{ value: string; expires_at: number }>()
            if (row) {
                const isExpired = row.expires_at <= nowSec
                const withinStale = staleWindowSeconds > 0 && row.expires_at + staleWindowSeconds > nowSec
                if (!isExpired) {
                    console.log(`[D1 Cache HIT] ${cacheKey}`)
                    return wrap(JSON.parse(row.value) as T, false)
                }
                if (withinStale) {
                    console.log(`[D1 Cache STALE] ${cacheKey}`)
                    const parsed = JSON.parse(row.value) as T
                    // Background refresh (fire-and-forget)
                    Promise.resolve()
                        .then(() => fetcher())
                        .then((fresh) => {
                            if (d1 && fresh !== undefined) {
                                return setCache(d1, cacheKey, JSON.stringify(fresh), ttlSeconds)
                            }
                        })
                        .catch((err) => console.error(`[D1 Cache Background refresh] ${cacheKey}`, err))
                    return wrap(parsed, true)
                }
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

    // Persist to D1 cache
    if (d1 && result !== undefined) {
        try {
            await setCache(d1, cacheKey, JSON.stringify(result), ttlSeconds)
            console.log(`[D1 Cache SET] ${cacheKey}`)
        } catch (err) {
            console.error(`[D1 Cache SET Error] ${cacheKey}`, err)
        }
    }

    return wrap(result as T, false)
}
