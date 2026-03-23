import { checkSingleFleetAppStatus } from '#server/utils/fleet-status'
import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'

/**
 * POST /api/fleet/status/[app]/refresh
 *
 * Admin-only endpoint that triggers an on-demand status check for a single fleet app.
 * Performs HEAD/GET check and upserts the result into the `app_status` table.
 */
export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'fleet-status-refresh', 10, 60_000)
  await requireAdmin(event)

  const appName = getRouterParam(event, 'app')
  if (!appName) {
    throw createError({ statusCode: 400, message: 'App name required in route string' })
  }

  const row = await checkSingleFleetAppStatus(event, appName)
  return { ok: true, status: row }
})
