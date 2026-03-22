import { z } from 'zod'
import { readBody } from 'h3'
import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { GoogleApiError, googleApiFetch, INDEXING_SCOPES } from '#layer/server/utils/google'

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
  try {
    const data = await googleApiFetch(
      'https://indexing.googleapis.com/v3/urlNotifications:publish',
      INDEXING_SCOPES,
      { method: 'POST', body: JSON.stringify({ url, type }) },
    )
    return { success: true, url, type, metadata: data }
  } catch (error: unknown) {
    if (error instanceof GoogleApiError) {
      if (error.status === 403) {
        throw createError({
          statusCode: 403,
          message:
            'Google Indexing API access denied. Verify the service account has Search Console ownership and Indexing API access.',
          data: error.body,
        })
      }

      throw createError({
        statusCode: error.status,
        message: `Google Indexing API error: ${error.message}`,
        data: error.body,
      })
    }

    const message = error instanceof Error ? error.message : 'Unknown indexing publish error'
    if (message.includes('not configured') || message.includes('service account')) {
      throw createError({
        statusCode: 503,
        message:
          'Google indexing is not configured: set GSC_SERVICE_ACCOUNT_JSON to enable Indexing API access.',
      })
    }

    throw createError({
      statusCode: 500,
      message,
    })
  }
})
