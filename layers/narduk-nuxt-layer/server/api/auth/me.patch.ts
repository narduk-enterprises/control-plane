import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '#layer/server/database/schema'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'

const bodySchema = z.object({
  name: z.string().optional(),
})

/**
 * PATCH /api/auth/me
 *
 * Update the authenticated user's profile (name only by default).
 * Apps can extend this route if they need additional fields.
 */
export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'auth-profile', 30, 60_000)
  const user = await requireAuth(event)
  const db = useDatabase(event)

  const raw = await readBody(event)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' })
  }
  const body = parsed.data

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  }

  if (typeof body.name === 'string') {
    updates.name = body.name.trim()
  }

  await db.update(users).set(updates).where(eq(users.id, user.id))

  // Refresh session so the sealed cookie reflects the new name
  const session = await getUserSession(event)
  if (session?.user) {
    await replaceUserSession(event, {
      ...session,
      user: {
        ...session.user,
        ...(updates.name !== undefined ? { name: updates.name as string | null } : {}),
      },
    })
  }

  return { ok: true }
})
