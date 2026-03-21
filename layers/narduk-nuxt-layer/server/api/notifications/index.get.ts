import { getQuery } from 'h3'

/**
 * GET /api/notifications
 *
 * Returns the authenticated user's notifications, newest first.
 * Query params: ?unreadOnly=true&limit=20
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event) as { unreadOnly?: string; limit?: string }

  const unreadOnly = query.unreadOnly === 'true'
  const limit = query.limit ? Math.min(Number.parseInt(query.limit, 10), 100) : 50

  const items = await getUserNotifications(event, user.id, { unreadOnly, limit })

  return { notifications: items }
})
