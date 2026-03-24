import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { createError, getRouterParam } from 'h3'
import { fleetApps, provisionJobs } from '#server/database/schema'
import { invalidateFleetAppListCache } from '#server/data/fleet-registry'
import { definePublicMutation, readValidatedMutationBody } from '#layer/server/utils/mutation'
import { assertProvisionApiKey } from '#server/utils/provision-api-auth'

const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().optional(),
)

const optionalUrlString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().url().optional(),
)

const bodySchema = z.object({
  status: z.enum(['complete', 'failed']),
  deployedUrl: optionalUrlString,
  githubRepo: optionalNonEmptyString,
  gaPropertyId: optionalNonEmptyString,
  gaMeasurementId: optionalNonEmptyString,
  errorMessage: optionalNonEmptyString,
})

/**
 * POST /api/fleet/provision/[id]/complete
 *
 * Final callback from the GitHub Action when provisioning is done (success or failure).
 * Auth'd via PROVISION_API_KEY.
 */
export default definePublicMutation(
  {
    rateLimit: { namespace: 'fleet-provision-callback', maxRequests: 60, windowMs: 60_000 },
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

    const [job] = existing
    if (!job) {
      throw createError({ statusCode: 404, message: `Provision job '${id}' not found.` })
    }

    const now = new Date().toISOString()
    const jobUpdates: {
      status: 'complete' | 'failed'
      updatedAt: string
      githubRunStatus: string
      githubRunConclusion: string
      deployedUrl?: string | null
      gaPropertyId?: string | null
      errorMessage?: string | null
    } = {
      status: body.status,
      updatedAt: now,
      githubRunStatus: 'completed',
      githubRunConclusion: body.status === 'complete' ? 'success' : 'failure',
    }

    if (body.deployedUrl !== undefined) {
      jobUpdates.deployedUrl = body.deployedUrl
    }
    if (body.gaPropertyId !== undefined) {
      jobUpdates.gaPropertyId = body.gaPropertyId
    }
    if (body.status === 'complete') {
      jobUpdates.errorMessage = null
    } else if (body.errorMessage !== undefined) {
      jobUpdates.errorMessage = body.errorMessage
    }

    await db.update(provisionJobs).set(jobUpdates).where(eq(provisionJobs.id, id))

    if (body.status === 'complete') {
      const fleetUpdates: {
        updatedAt: string
        url?: string
        githubRepo?: string
        gaPropertyId?: string | null
        gaMeasurementId?: string | null
      } = {
        updatedAt: now,
      }

      if (body.deployedUrl) {
        fleetUpdates.url = body.deployedUrl
      }
      if (body.githubRepo) {
        fleetUpdates.githubRepo = body.githubRepo
      }
      if (body.gaPropertyId !== undefined) {
        fleetUpdates.gaPropertyId = body.gaPropertyId
      }
      if (body.gaMeasurementId !== undefined) {
        fleetUpdates.gaMeasurementId = body.gaMeasurementId
      }

      await db.update(fleetApps).set(fleetUpdates).where(eq(fleetApps.name, job.appName))

      await invalidateFleetAppListCache(event)
    }

    return {
      ok: true,
      id,
      status: body.status,
      message:
        body.status === 'complete'
          ? `App provisioning complete.`
          : `App provisioning failed: ${body.errorMessage || 'unknown error'}`,
    }
  },
)
