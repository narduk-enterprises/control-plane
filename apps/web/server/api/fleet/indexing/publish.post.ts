import { z } from 'zod'
import { defineAdminMutation, readValidatedMutationBody } from '#layer/server/utils/mutation'
import { GoogleApiError, googleApiFetch, INDEXING_SCOPES } from '#layer/server/utils/google'

const bodySchema = z.object({
  url: z.string().url(),
  type: z.enum(['URL_UPDATED', 'URL_DELETED']).optional().default('URL_UPDATED'),
})

export default defineAdminMutation(
  {
    rateLimit: { namespace: 'fleet-indexing-publish', maxRequests: 10, windowMs: 60_000 },
    parseBody: async (event) => readValidatedMutationBody(event, bodySchema.parse),
  },
  async ({ body }) => {
    const { url, type } = body
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
  },
)
