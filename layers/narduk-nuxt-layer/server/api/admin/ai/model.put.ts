import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import { kvSet } from '../../../utils/kv'

const schema = z.object({
  model: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody(event)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid model name.' })
  }

  // Store in cache with highly distant expiration (never expires basically)
  // KV Cache allows string values up to 4MB
  await kvSet(event, 'admin:chatModel', { value: parsed.data.model }, 365 * 24 * 60 * 60)

  return { success: true, model: parsed.data.model }
})
