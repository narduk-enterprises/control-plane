/**
 * Cron handler: check all fleet app statuses and persist to D1.
 * Warms individual GA, GSC, and PostHog caches for each fleet app,
 * then refreshes the fleet-wide analytics summary and insights.
 *
 * Triggered by Cloudflare Cron Trigger (every hour: "0 * * * *")
 * via the `[triggers]` block in wrangler.json.
 *
 * Can also be invoked manually: GET /_cron/fleet-status
 *
 * Uses a **time-bounded execution model** to stay within Cloudflare
 * Worker CPU limits. Each phase checks remaining wall-clock time
 * before executing, and the cache-warming phase is skipped entirely
 * if health checks consume too much of the budget.
 */
import { cleanExpiredCache } from '#layer/server/utils/d1Cache'

/** Wall-clock deadline in ms — abort remaining work before hitting Worker limits */
const DEADLINE_MS = 25_000
/** Timeout per subrequest in ms */
const SUBREQUEST_TIMEOUT_MS = 8_000
/** Max apps to warm concurrently (lower = less peak CPU) */
const BATCH_SIZE = 3

export default defineEventHandler(async (event) => {
  const startTime = Date.now()
  const elapsed = () => Date.now() - startTime
  const remaining = () => DEADLINE_MS - elapsed()

  const phases: Record<string, number> = {}

  // Phase 0: Health checks
  const rows = await checkAllFleetStatuses(event)
  phases.healthChecks = elapsed()

  const config = useRuntimeConfig()
  const baseURL = getRequestURL(event).origin

  if (!config.cronSecret) {
    return {
      ok: true,
      checked: rows.length,
      phases,
      timestamp: new Date().toISOString(),
    }
  }

  const end = new Date().toISOString().split('T')[0] ?? ''
  const start = new Date()
  start.setDate(start.getDate() - 30)
  const startStr = start.toISOString().split('T')[0] ?? ''
  const headers: Record<string, string> = {
    'X-Internal-Cron': config.cronSecret,
    'X-Requested-With': 'XMLHttpRequest',
  }
  const dateQuery = `startDate=${encodeURIComponent(startStr)}&endDate=${encodeURIComponent(end)}`

  // Phase 1: Warm individual app analytics caches (GA + GSC + PostHog).
  // Batched with timeout guards. Skip entirely if we've already used too much time.
  const appNames = rows.map((r) => r.app)
  let warmed = 0
  let warmingSkipped = false

  if (remaining() > SUBREQUEST_TIMEOUT_MS + 2_000) {
    for (let i = 0; i < appNames.length; i += BATCH_SIZE) {
      // Check deadline before each batch
      if (remaining() < SUBREQUEST_TIMEOUT_MS + 2_000) {
        console.log(
          `[Cron] Deadline approaching after ${warmed}/${appNames.length} apps — stopping cache warming`,
        )
        break
      }

      const batch = appNames.slice(i, i + BATCH_SIZE)
      const calls = batch.flatMap((app) => {
        const slug = encodeURIComponent(app)
        return [
          $fetch(`${baseURL}/api/fleet/ga/${slug}?${dateQuery}`, {
            headers,
            signal: AbortSignal.timeout(SUBREQUEST_TIMEOUT_MS),
          }).catch(() => null),
          $fetch(`${baseURL}/api/fleet/gsc/${slug}?${dateQuery}`, {
            headers,
            signal: AbortSignal.timeout(SUBREQUEST_TIMEOUT_MS),
          }).catch(() => null),
          $fetch(`${baseURL}/api/fleet/posthog/${slug}?${dateQuery}&summaryOnly=true`, {
            headers,
            signal: AbortSignal.timeout(SUBREQUEST_TIMEOUT_MS),
          }).catch(() => null),
        ]
      })
      await Promise.allSettled(calls)
      warmed += batch.length
    }
  } else {
    warmingSkipped = true
    console.log(
      `[Cron] Skipping cache warming — only ${remaining()}ms remaining after health checks`,
    )
  }
  phases.cacheWarming = elapsed()

  // Phase 2: Refresh fleet-wide summary and insights (reads from now-warm D1 caches).
  // Only run if we have enough time remaining.
  let aggregated = false
  if (remaining() > SUBREQUEST_TIMEOUT_MS + 1_000) {
    await Promise.allSettled([
      $fetch(`${baseURL}/api/fleet/analytics/summary?${dateQuery}&force=true`, {
        headers,
        signal: AbortSignal.timeout(SUBREQUEST_TIMEOUT_MS),
      }),
      $fetch(`${baseURL}/api/fleet/analytics/insights?${dateQuery}&force=true`, {
        headers,
        signal: AbortSignal.timeout(SUBREQUEST_TIMEOUT_MS),
      }),
    ])
    aggregated = true
  } else {
    console.log(`[Cron] Skipping aggregation — only ${remaining()}ms remaining`)
  }
  phases.aggregation = elapsed()

  // Phase 3: Evict expired cache entries to prevent unbounded D1 growth.
  let evicted = 0
  if (remaining() > 1_000) {
    evicted = await cleanExpiredCache(event)
  }
  phases.total = elapsed()

  return {
    ok: true,
    checked: rows.length,
    warmed,
    warmingSkipped,
    aggregated,
    evicted,
    phases,
    timestamp: new Date().toISOString(),
  }
})
