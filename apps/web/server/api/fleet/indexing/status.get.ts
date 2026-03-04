import { z } from 'zod'
import { GoogleApiError, googleApiFetch, INDEXING_SCOPES } from '#layer/server/utils/google'

const querySchema = z.object({ url: z.string().url() })

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await enforceRateLimit(event, 'fleet-indexing-status', 20, 60_000)

  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Query url required' })

  const { url } = parsed.data
  const encoded = encodeURIComponent(url)

  try {
    const data = await googleApiFetch(
      `https://indexing.googleapis.com/v3/urlNotifications/metadata?url=${encoded}`,
      INDEXING_SCOPES,
    )
    return { url, metadata: data }
  } catch (err) {
    if (err instanceof GoogleApiError && err.status === 404) {
      throw createError({
        statusCode: 404,
        message: `No indexing metadata found for ${url}. This usually means the URL hasn't been submitted to the Indexing API yet or isn't part of a verified Search Console property.`,
      })
    }
    throw err
  }
})
