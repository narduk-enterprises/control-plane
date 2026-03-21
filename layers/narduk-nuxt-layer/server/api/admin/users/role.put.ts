import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { useDatabase } from '../../../utils/database'
import { users } from '../../../database/schema'

const schema = z.object({
  userId: z.string().min(1),
  isAdmin: z.boolean(),
})

export default defineEventHandler(async (event) => {
  const currentAdmin = await requireAdmin(event)
  
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid payload.' })
  }

  // Prevent admin from removing their own admin privileges by accident
  if (parsed.data.userId === currentAdmin.id && !parsed.data.isAdmin) {
    throw createError({ statusCode: 403, message: 'Cannot demote yourself.' })
  }

  const db = useDatabase(event)
  
  await db
    .update(users)
    .set({
      isAdmin: parsed.data.isAdmin,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, parsed.data.userId))
    .run()

  return { success: true }
})
