import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAdmin } from '#layer/server/utils/auth'
import { useDatabase } from '#layer/server/utils/database'
import { systemPrompts } from '#layer/server/database/schema'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'

const schema = z.object({
  name: z.string().min(1),
  content: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'admin-system-prompts', 20, 60_000)
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
