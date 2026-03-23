import { defineAdminMutation } from '#layer/server/utils/mutation'

/**
 * POST /api/fleet/status/refresh
 *
 * Admin-only endpoint that triggers an on-demand status check for all fleet apps.
 * Performs HEAD/GET checks and upserts results into the `app_status` table.
 */
export default defineAdminMutation(
  { rateLimit: { namespace: 'fleet-status-refresh', maxRequests: 10, windowMs: 60_000 } },
  async ({ event }) => {
    const rows = await checkAllFleetStatuses(event)
    return { ok: true, checked: rows.length, statuses: rows }
  },
)
