import { eq } from 'drizzle-orm'
import { getHeader, createError, getRouterParam } from 'h3'
import { provisionJobs } from '#server/database/schema'
import { reconcileProvisionJobWithGitHub } from '#server/utils/provision-job-reconciliation'

/**
 * GET /api/fleet/provision/[id]
 *
 * Poll the status of a provision job. Auth'd via PROVISION_API_KEY.
 */
export default defineEventHandler(async (event) => {
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

  const db = useDatabase(event)
  const jobs = await db.select().from(provisionJobs).where(eq(provisionJobs.id, id)).limit(1).all()

  if (jobs.length === 0) {
    throw createError({ statusCode: 404, message: `Provision job '${id}' not found.` })
  }

  const job = await reconcileProvisionJobWithGitHub(event, jobs[0]!)

  return {
    id: job.id,
    appName: job.appName,
    displayName: job.displayName,
    appUrl: job.appUrl,
    githubRepo: job.githubRepo,
    nuxtPort: job.nuxtPort,
    status: job.status,
    githubRunId: job.githubRunId,
    githubRunUrl: job.githubRunUrl,
    githubRunStatus: job.githubRunStatus,
    githubRunConclusion: job.githubRunConclusion,
    deployedUrl: job.deployedUrl,
    gaPropertyId: job.gaPropertyId,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
})
