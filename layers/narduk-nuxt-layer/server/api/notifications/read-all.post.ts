/**
 * POST /api/notifications/read-all
 *
 * Mark all notifications as read for the authenticated user.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  await markAllNotificationsAsRead(event, user.id)

  return { ok: true }
})
