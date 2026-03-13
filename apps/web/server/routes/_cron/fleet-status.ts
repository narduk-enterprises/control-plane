/**
 * Cron handler: check all fleet app statuses and persist to D1.
 * Warms individual GA, GSC, and PostHog caches for each fleet app,
 * then refreshes the fleet-wide analytics summary and insights.
 *
 * Triggered by Cloudflare Cron Trigger (every hour: "0 * * * *")
 * via the `[triggers]` block in wrangler.json.
 *
 * Can also be invoked manually: GET /_cron/fleet-status
 */
import { cleanExpiredCache } from '#layer/server/utils/d1Cache'

export default defineEventHandler(async (event) => {
  const rows = await checkAllFleetStatuses(event)
  const config = useRuntimeConfig()
  const baseURL = getRequestURL(event).origin

  if (!config.cronSecret) {
    return { ok: true, checked: rows.length, timestamp: new Date().toISOString() }
  }

  const end = new Date().toISOString().split('T')[0] ?? ''
  const start = new Date()
  start.setDate(start.getDate() - 30)
  const startStr = start.toISOString().split('T')[0] ?? ''
  const headers = { 'X-Internal-Cron': config.cronSecret, 'X-Requested-With': 'XMLHttpRequest' }
  const dateQuery = `startDate=${encodeURIComponent(startStr)}&endDate=${encodeURIComponent(end)}`

  // Phase 1: Warm individual app analytics caches (GA + GSC + PostHog).
  // Batch in groups of 5 to avoid overwhelming Google API quotas.
  const appNames = rows.map((r) => r.app)
  const BATCH_SIZE = 5
  let warmed = 0

  for (let i = 0; i < appNames.length; i += BATCH_SIZE) {
    const batch = appNames.slice(i, i + BATCH_SIZE)
    const calls = batch.flatMap((app) => {
      const slug = encodeURIComponent(app)
      return [
        $fetch(`${baseURL}/api/fleet/ga/${slug}?${dateQuery}`, { headers }).catch(() => null),
        $fetch(`${baseURL}/api/fleet/gsc/${slug}?${dateQuery}`, { headers }).catch(() => null),
        $fetch(`${baseURL}/api/fleet/posthog/${slug}?${dateQuery}&summaryOnly=true`, {
          headers,
        }).catch(() => null),
      ]
    })
    await Promise.allSettled(calls)
    warmed += batch.length
  }

  // Phase 2: Refresh fleet-wide summary and insights (reads from now-warm D1 caches).
  await Promise.allSettled([
    $fetch(`${baseURL}/api/fleet/analytics/summary?${dateQuery}&force=true`, { headers }),
    $fetch(`${baseURL}/api/fleet/analytics/insights?${dateQuery}&force=true`, { headers }),
  ])

  // Phase 3: Evict expired cache entries to prevent unbounded D1 growth.
  const evicted = await cleanExpiredCache(event)

  return { ok: true, checked: rows.length, warmed, evicted, timestamp: new Date().toISOString() }
})
