/**
 * Cron handler: check all fleet app statuses and persist to D1.
 * Warms the **per-app analytics detail** D1 snapshot (same key as the UI:
 * `fleet-analytics-app-detail-{app}-{start}-{end}`), which fills GA/GSC/PostHog
 * sub-caches including full PostHog + GSC device/series. Then refreshes the
 * fleet-wide summary and insights.
 *
 * Triggered by Cloudflare Cron Trigger (every hour: "0 * * * *")
 * via the `[triggers]` block in wrangler.json.
 *
 * After analytics warming, runs **GSC sitemap sync**: fetch each app’s sitemap.xml,
 * compare SHA-256 fingerprint to D1, and submit to Search Console when it changed
 * (requires service account with `webmasters` scope, not just readonly).
 *
 * Can also be invoked manually: GET /_cron/fleet-status
 *
 * Uses a **time-bounded execution model** to stay within Cloudflare
 * Worker CPU limits. Each phase checks remaining wall-clock time
 * before executing, and the cache-warming phase is skipped entirely
 * if health checks consume too much of the budget.
 */
import { cleanExpiredCache } from '#layer/server/utils/d1Cache'
import { runFleetGscSitemapCronSync } from '#server/utils/fleet-gsc-sitemap'

/** Wall-clock deadline in ms — abort remaining work before hitting Worker limits */
const DEADLINE_MS = 25_000
/** Timeout per subrequest in ms (detail builds GA+GSC+PostHog) */
const SUBREQUEST_TIMEOUT_MS = 12_000
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
    console.warn(
      '[Cron:fleet-status] CRON_SECRET is not set — skipping analytics cache warming and summary refresh. Set CRON_SECRET in Doppler (prd) and redeploy.',
    )
    return {
      ok: true,
      checked: rows.length,
      phases,
      cronSecretConfigured: false,
      timestamp: new Date().toISOString(),
    }
  }

  console.log(
    `[Cron:fleet-status] start apps=${rows.length} origin=${baseURL} budgetMs=${DEADLINE_MS}`,
  )

  const end = new Date().toISOString().split('T')[0] ?? ''
  const start = new Date()
  start.setDate(start.getDate() - 30)
  const startStr = start.toISOString().split('T')[0] ?? ''
  const headers: Record<string, string> = {
    'X-Internal-Cron': config.cronSecret,
    'X-Requested-With': 'XMLHttpRequest',
  }
  const dateQuery = `startDate=${encodeURIComponent(startStr)}&endDate=${encodeURIComponent(end)}`

  // Phase 1: Warm per-app detail snapshots (populates D1 row the analytics page reads).
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
      const calls = batch.map((app) => {
        const slug = encodeURIComponent(app)
        return $fetch(`${baseURL}/api/fleet/analytics/${slug}?${dateQuery}`, {
          headers,
          signal: AbortSignal.timeout(SUBREQUEST_TIMEOUT_MS),
        }).catch(() => null)
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

  // Phase 3: GSC sitemap auto-submit when sitemap body changes (same hourly cron).
  let gscSitemap: Awaited<ReturnType<typeof runFleetGscSitemapCronSync>> | null = null
  if (remaining() > 3_000) {
    gscSitemap = await runFleetGscSitemapCronSync(event, {
      startedAt: startTime,
      deadlineMs: DEADLINE_MS,
    })
    phases.gscSitemapMs = gscSitemap.ms
  } else {
    phases.gscSitemapMs = 0
  }
  phases.afterGscSitemap = elapsed()

  // Phase 4: Evict expired cache entries to prevent unbounded D1 growth.
  let evicted = 0
  if (remaining() > 1_000) {
    evicted = await cleanExpiredCache(event)
  }
  phases.total = elapsed()

  const payload = {
    ok: true,
    checked: rows.length,
    warmed,
    warmingSkipped,
    aggregated,
    gscSitemap,
    evicted,
    phases,
    cronSecretConfigured: true,
    timestamp: new Date().toISOString(),
  }
  console.log(
    `[Cron:fleet-status] done warmed=${warmed} aggregated=${aggregated} gscSitemap=${gscSitemap ? `scanned=${gscSitemap.scanned} submitted=${gscSitemap.submitted}` : 'skipped'} evicted=${evicted} totalMs=${phases.total}`,
  )
  return payload
})
