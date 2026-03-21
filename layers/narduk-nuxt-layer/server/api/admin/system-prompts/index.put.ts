import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { useDatabase } from '../../../utils/database'
import { systemPrompts } from '../../../database/schema'

const schema = z.object({
  name: z.string().min(1),
  content: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid prompt data.',
    })
  }

  const db = useDatabase(event)
  
  await db
    .update(systemPrompts)
    .set({
      content: parsed.data.content,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(systemPrompts.name, parsed.data.name))
    .run()

  return { success: true }
})
