import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { createError, getRouterParam } from 'h3'
import { provisionJobs } from '#server/database/schema'
import { definePublicMutation, readValidatedMutationBody } from '#layer/server/utils/mutation'
import { assertProvisionApiKey } from '#server/utils/provision-api-auth'

const bodySchema = z.object({
  status: z.enum(['pending', 'cloning', 'initializing', 'deploying', 'complete', 'failed']),
})

/**
 * POST /api/fleet/provision/[id]/status
 *
 * Called by the GitHub Action to update provision job status during execution.
 * Auth'd via PROVISION_API_KEY.
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
      throw createError({ statusCode: 400, message: 'Missing provision job ID' })
    }

    const db = useDatabase(event)

    // Verify job exists
    const existing = await db
      .select()
      .from(provisionJobs)
      .where(eq(provisionJobs.id, id))
      .limit(1)
      .all()

    if (existing.length === 0) {
      throw createError({ statusCode: 404, message: `Provision job '${id}' not found.` })
    }

    const now = new Date().toISOString()
    await db
      .update(provisionJobs)
      .set({ status: body.status, updatedAt: now })
      .where(eq(provisionJobs.id, id))

    return { ok: true, id, status: body.status }
  },
)
