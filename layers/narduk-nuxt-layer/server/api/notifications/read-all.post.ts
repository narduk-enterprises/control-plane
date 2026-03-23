/**
 * POST /api/notifications/read-all
 *
 * Mark all notifications as read for the authenticated user.
 */
import { enforceRateLimit } from '#layer/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'notifications', 60, 60_000)
  const user = await requireAuth(event)

  await markAllNotificationsAsRead(event, user.id)

  return { ok: true }
})
