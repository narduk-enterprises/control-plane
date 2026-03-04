import { requireAdmin } from '#layer/server/utils/auth'

/**
 * POST /api/fleet/status/refresh
 *
 * Admin-only endpoint that triggers an on-demand status check for all fleet apps.
 * Performs HEAD/GET checks and upserts results into the `app_status` table.
 */
export default defineEventHandler(async (event) => {
    await requireAdmin(event)
    const rows = await checkAllFleetStatuses(event)
    return { ok: true, checked: rows.length, statuses: rows }
})
