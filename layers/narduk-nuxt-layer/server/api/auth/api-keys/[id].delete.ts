import { requireAuth } from '#layer/server/utils/auth'
import { apiKeys } from '#layer/server/database/schema'
import { eq, and } from 'drizzle-orm'

/**
 * DELETE /api/auth/api-keys/:id
 * Revoke (delete) an API key. Users can only delete their own keys.
 */
export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'auth-api-keys', 10, 60_000)

  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing key ID' })
  }

  const db = useDatabase(event)

  const deleted = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, user.id)))
    .returning({ id: apiKeys.id })

  if (deleted.length === 0) {
    throw createError({ statusCode: 404, message: 'API key not found' })
  }

  return { success: true }
})
