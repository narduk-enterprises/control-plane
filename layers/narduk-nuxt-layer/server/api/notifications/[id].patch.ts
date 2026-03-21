/**
 * PATCH /api/notifications/:id
 *
 * Mark a single notification as read. Owner-only.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const notificationId = getRouterParam(event, 'id')

  if (!notificationId) {
    throw createError({ statusCode: 400, message: 'Notification ID is required.' })
  }

  await markNotificationAsRead(event, notificationId, user.id)

  return { ok: true }
})
