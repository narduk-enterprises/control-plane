import { z } from 'zod'
import { readBody } from 'h3'
import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { googleApiFetch, INDEXING_SCOPES } from '#layer/server/utils/google'

const bodySchema = z.object({
  url: z.string().url(),
  type: z.enum(['URL_UPDATED', 'URL_DELETED']).optional().default('URL_UPDATED'),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await enforceRateLimit(event, 'fleet-indexing-publish', 10, 60_000)

  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid body: url required' })

  const { url, type } = parsed.data
  const data = await googleApiFetch(
    'https://indexing.googleapis.com/v3/urlNotifications:publish',
    INDEXING_SCOPES,
    { method: 'POST', body: JSON.stringify({ url, type }) },
  )
  return { success: true, url, type, metadata: data }
})
