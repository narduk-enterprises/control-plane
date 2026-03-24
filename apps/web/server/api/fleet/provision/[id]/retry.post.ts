import { eq } from 'drizzle-orm'
import { createError, getRouterParam } from 'h3'
import { provisionJobs, provisionJobLogs } from '#server/database/schema'
import { defineAdminMutation } from '#layer/server/utils/mutation'

/**
 * POST /api/fleet/provision/[id]/retry
 *
 * Re-dispatch provision-app.yml for a failed job. Session admin only.
 */
export default defineAdminMutation(
  {
    rateLimit: { namespace: 'fleet-provision-retry', maxRequests: 15, windowMs: 60_000 },
  },
  async ({ event }) => {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, message: 'Missing provision ID' })
    }

    const db = useDatabase(event)
    const job = await db
      .select()
      .from(provisionJobs)
      .where(eq(provisionJobs.id, id))
      .get()

    if (!job) {
      throw createError({
        statusCode: 404,
        message: 'Provision job not found',
      })
    }

    if (job.status !== 'failed') {
      throw createError({
        statusCode: 400,
        message: 'Only failed jobs can be retried.',
      })
    }

    const runtimeConfig = useRuntimeConfig(event)
    const ghToken = runtimeConfig.controlPlaneGhServiceToken
    if (!ghToken) {
      throw createError({
        statusCode: 500,
        message: 'CONTROL_PLANE_GH_SERVICE_TOKEN not configured.',
      })
    }

    try {
      await $fetch(
        `https://api.github.com/repos/narduk-enterprises/control-plane/actions/workflows/provision-app.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${ghToken}`,
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: {
            ref: 'main',
            inputs: {
              'app-name': job.appName,
              'display-name': job.displayName,
              'app-url': job.appUrl,
              'github-repo': job.githubRepo,
              'provision-id': job.id,
              'nuxt-port': job.nuxtPort?.toString() || '',
              'ga-property-id': job.gaPropertyId || '',
            },
          },
        },
      )

      await db.insert(provisionJobLogs).values({
        id: crypto.randomUUID(),
        provisionId: job.id,
        level: 'info',
        step: 'retry',
        message: 'Retry triggered by user via control plane',
      })

      await db
        .update(provisionJobs)
        .set({
          status: 'pending',
          errorMessage: null,
        })
        .where(eq(provisionJobs.id, job.id))

      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('Failed to dispatch GitHub Action for retry:', err)

      await db.insert(provisionJobLogs).values({
        id: crypto.randomUUID(),
        provisionId: job.id,
        level: 'error',
        step: 'retry',
        message: `Failed to dispatch GitHub workflow: ${message}`,
      })

      throw createError({
        statusCode: 500,
        message: `Failed to dispatch GitHub Action: ${message}`,
      })
    }
  },
)
