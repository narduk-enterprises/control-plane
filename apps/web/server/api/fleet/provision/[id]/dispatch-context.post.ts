import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { createError, getRouterParam } from 'h3'
import { provisionJobs } from '#server/database/schema'
import { definePublicMutation, readValidatedMutationBody } from '#layer/server/utils/mutation'
import { assertProvisionApiKey } from '#server/utils/provision-api-auth'
import {
  mergeDispatchInputs,
  parseStoredDispatchInputs,
  PROVISION_WORKFLOW_INPUT_KEYS,
  buildProvisionWorkflowDispatchInputs,
} from '#server/utils/provision-workflow-dispatch'

const allowedPatchKeys = new Set<string>(
  PROVISION_WORKFLOW_INPUT_KEYS.filter((k) => k !== 'provision-id'),
)

const bodySchema = z.record(z.string(), z.string()).superRefine((val, ctx) => {
  for (const k of Object.keys(val)) {
    if (!allowedPatchKeys.has(k)) {
      ctx.addIssue({
        code: 'custom',
        message: k === 'provision-id' ? 'provision-id cannot be updated via this endpoint' : `Unknown key: ${k}`,
        path: [k],
      })
    }
  }
})

/**
 * POST /api/fleet/provision/[id]/dispatch-context
 *
 * Merge workflow_dispatch input snapshot (for retries). Auth: PROVISION_API_KEY.
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

    const db = useDatabase(event)
    const job = await db.select().from(provisionJobs).where(eq(provisionJobs.id, id)).get()

    if (!job) {
      throw createError({ statusCode: 404, message: 'Provision job not found' })
    }

    const stored = parseStoredDispatchInputs(job.dispatchInputsJson)
    const base = buildProvisionWorkflowDispatchInputs({
      appName: job.appName,
      displayName: job.displayName,
      appUrl: job.appUrl,
      githubRepo: job.githubRepo,
      provisionId: job.id,
      nuxtPort: job.nuxtPort != null ? String(job.nuxtPort) : '',
    })
    const previous = stored ? mergeDispatchInputs(base, stored) : base
    const merged = mergeDispatchInputs(previous, body)
    merged['provision-id'] = job.id

    const now = new Date().toISOString()
    await db
      .update(provisionJobs)
      .set({
        dispatchInputsJson: JSON.stringify(merged),
        updatedAt: now,
      })
      .where(eq(provisionJobs.id, id))

    return { ok: true, id }
  },
)
