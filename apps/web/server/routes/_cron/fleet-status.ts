/**
 * Cron handler: check all fleet app statuses and persist to D1.
 *
 * Triggered by Cloudflare Cron Trigger (every hour: "0 * * * *")
 * via the `[triggers]` block in wrangler.json.
 *
 * Can also be invoked manually: GET /_cron/fleet-status
 */
export default defineEventHandler(async (event) => {
    const rows = await checkAllFleetStatuses(event)
    return { ok: true, checked: rows.length, timestamp: new Date().toISOString() }
})
