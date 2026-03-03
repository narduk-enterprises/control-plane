import { z } from 'zod'
import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { googleApiFetch, INDEXING_SCOPES } from '#layer/server/utils/google'

const querySchema = z.object({ url: z.string().url() })

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await enforceRateLimit(event, 'fleet-indexing-status', 20, 60_000)

  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Query url required' })

  const { url } = parsed.data
  const encoded = encodeURIComponent(url)
  const data = await googleApiFetch(
    `https://indexing.googleapis.com/v3/urlNotifications/metadata?url=${encoded}`,
    INDEXING_SCOPES,
  )
  return { url, metadata: data }
})
