import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { readBody, getHeader, createError, getRouterParam } from 'h3'
import { provisionJobs } from '#server/database/schema'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'

const bodySchema = z.object({
  status: z.enum(['complete', 'failed']),
  deployedUrl: z.string().url().optional(),
  githubRepo: z.string().optional(),
  gaPropertyId: z.string().optional(),
  errorMessage: z.string().optional(),
})

/**
 * POST /api/fleet/provision/[id]/complete
 *
 * Final callback from the GitHub Action when provisioning is done (success or failure).
 * Auth'd via PROVISION_API_KEY.
 */
export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'fleet-provision-callback', 60, 60_000)

  // Auth
  const config = useRuntimeConfig(event)
  const authHeader = getHeader(event, 'authorization')
  const providedKey = authHeader?.replace('Bearer ', '')

  if (!config.provisionApiKey || providedKey !== config.provisionApiKey) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing provision job ID' })
  }

  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: `Validation error: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    })
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
    .set({
      status: parsed.data.status,
      deployedUrl: parsed.data.deployedUrl ?? null,
      gaPropertyId: parsed.data.gaPropertyId ?? null,
      errorMessage: parsed.data.errorMessage ?? null,
      updatedAt: now,
    })
    .where(eq(provisionJobs.id, id))

  return {
    ok: true,
    id,
    status: parsed.data.status,
    message:
      parsed.data.status === 'complete'
        ? `App provisioning complete.`
        : `App provisioning failed: ${parsed.data.errorMessage || 'unknown error'}`,
  }
})
