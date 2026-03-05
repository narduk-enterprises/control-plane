/**
 * Cron handler: check all fleet app statuses and persist to D1.
 * Also warms fleet analytics summary and insights cache when CRON_SECRET is set.
 *
 * Triggered by Cloudflare Cron Trigger (every hour: "0 * * * *")
 * via the `[triggers]` block in wrangler.json.
 *
 * Can also be invoked manually: GET /_cron/fleet-status
 */
export default defineEventHandler(async (event) => {
    const rows = await checkAllFleetStatuses(event)
    const config = useRuntimeConfig()
    const baseURL = getRequestURL(event).origin
    if (config.cronSecret) {
        const end = new Date().toISOString().split('T')[0] ?? ''
        const start = new Date()
        start.setDate(start.getDate() - 30)
        const startStr = start.toISOString().split('T')[0] ?? ''
        const headers = { 'X-Internal-Cron': config.cronSecret, 'X-Requested-With': 'XMLHttpRequest' }
        await Promise.allSettled([
            $fetch(`${baseURL}/api/fleet/analytics/summary?startDate=${encodeURIComponent(startStr)}&endDate=${encodeURIComponent(end)}`, { headers }),
            $fetch(`${baseURL}/api/fleet/analytics/insights?startDate=${encodeURIComponent(startStr)}&endDate=${encodeURIComponent(end)}`, { headers }),
        ])
    }
    return { ok: true, checked: rows.length, timestamp: new Date().toISOString() }
})
