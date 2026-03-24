import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { createError, getRouterParam, setResponseStatus } from 'h3'
import { provisionJobs, provisionJobLogs } from '#server/database/schema'
import { definePublicMutation, readValidatedMutationBody } from '#layer/server/utils/mutation'
import { assertProvisionApiKey } from '#server/utils/provision-api-auth'

const bodySchema = z.object({
  level: z.enum(['info', 'error', 'success']).default('info'),
  message: z.string().min(1),
  step: z.string().optional(),
})

/**
 * POST /api/fleet/provision/[id]/log
 *
 * Append a pipeline log line from GitHub Actions. Auth: PROVISION_API_KEY.
 */
export default definePublicMutation(
  {
    rateLimit: { namespace: 'fleet-provision-callback', maxRequests: 120, windowMs: 60_000 },
    parseBody: async (event) => {
      assertProvisionApiKey(event)
      return readValidatedMutationBody(event, bodySchema.parse)
    },
  },
  async ({ event, body }) => {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, message: 'Missing provision ID' })
    }

    const { level, message, step } = body
    const db = useDatabase(event)

    const existingJob = await db
      .select()
      .from(provisionJobs)
      .where(eq(provisionJobs.id, id))
      .limit(1)
      .all()

    if (existingJob.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Provision job not found',
      })
    }

    await db.insert(provisionJobLogs).values({
      id: crypto.randomUUID(),
      provisionId: id,
      level,
      message,
      step,
    })

    setResponseStatus(event, 201)
    return { success: true }
  },
)
