/**
 * DELETE /api/notifications/:id
 *
 * Delete a single notification. Owner-only.
 */
import { enforceRateLimit } from '#layer/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'notifications', 60, 60_000)
  const user = await requireAuth(event)
  const notificationId = getRouterParam(event, 'id')

  if (!notificationId) {
    throw createError({ statusCode: 400, message: 'Notification ID is required.' })
  }

  await deleteNotification(event, notificationId, user.id)

  return { ok: true }
})
