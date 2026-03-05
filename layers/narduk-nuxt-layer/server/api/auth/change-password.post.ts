import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'
import { verifyPassword, hashPassword } from '../../utils/password'
import { requireAuth } from '../../utils/auth'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
})

/**
 * POST /api/auth/change-password
 *
 * Requires authentication. Verifies the current password,
 * then hashes and stores the new one.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readValidatedBody(event, changePasswordSchema.parse)

  // Verify current password
  if (!user.passwordHash) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Account does not have a password set',
    })
  }

  const isValid = await verifyPassword(body.currentPassword, user.passwordHash)
  if (!isValid) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Current password is incorrect',
    })
  }

  // Hash new password and update
  const newHash = await hashPassword(body.newPassword)
  const db = useDatabase(event)
  await db.update(users).set({
    passwordHash: newHash,
    updatedAt: new Date().toISOString(),
  }).where(eq(users.id, user.id))

  return { success: true }
})
