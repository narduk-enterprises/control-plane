import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { readBody, getHeader, createError, getRouterParam } from 'h3'
import { provisionJobs } from '#server/database/schema'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'

const bodySchema = z.object({
  status: z.enum(['pending', 'cloning', 'initializing', 'deploying', 'complete', 'failed']),
})

/**
 * POST /api/fleet/provision/[id]/status
 *
 * Called by the GitHub Action to update provision job status during execution.
 * Auth'd via PROVISION_API_KEY.
 */
export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'fleet-provision-callback', 120, 60_000)

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
    .set({ status: parsed.data.status, updatedAt: now })
    .where(eq(provisionJobs.id, id))

  return { ok: true, id, status: parsed.data.status }
})
