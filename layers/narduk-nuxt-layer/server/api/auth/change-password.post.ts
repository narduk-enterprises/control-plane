import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'
import { verifyPassword, hashPassword } from '../../utils/password'
import { requireAuth } from '../../utils/auth'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

/**
 * POST /api/auth/change-password
 *
 * Requires authentication. Verifies the current password,
 * then hashes and stores the new one.
 */
export default defineEventHandler(async (event) => {
  const userSession = await requireAuth(event)
  const body = await readValidatedBody(event, changePasswordSchema.parse)

  const db = useDatabase(event)

  const dbUser = await db.select().from(users).where(eq(users.id, userSession.id)).get()

  if (!dbUser || !dbUser.passwordHash) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized - invalid user state',
    })
  }

  const isValid = await verifyPassword(body.currentPassword, dbUser.passwordHash)
  if (!isValid) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid current password',
    })
  }

  const hashedNewPassword = await hashPassword(body.newPassword)

  await db
    .update(users)
    .set({
      passwordHash: hashedNewPassword,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userSession.id))
    .run()

  return { success: true }
})
