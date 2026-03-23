import { checkSingleFleetAppStatus } from '#server/utils/fleet-status'
import { defineAdminMutation } from '#layer/server/utils/mutation'

/**
 * POST /api/fleet/status/[app]/refresh
 *
 * Admin-only endpoint that triggers an on-demand status check for a single fleet app.
 * Performs HEAD/GET check and upserts the result into the `app_status` table.
 */
export default defineAdminMutation(
  { rateLimit: { namespace: 'fleet-status-refresh', maxRequests: 10, windowMs: 60_000 } },
  async ({ event }) => {
    const appName = getRouterParam(event, 'app')
    if (!appName) {
      throw createError({ statusCode: 400, message: 'App name required in route string' })
    }

    const row = await checkSingleFleetAppStatus(event, appName)
    return { ok: true, status: row }
  },
)
