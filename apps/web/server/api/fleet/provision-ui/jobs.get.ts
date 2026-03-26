import { desc, inArray } from 'drizzle-orm'
import { requireAdmin } from '#layer/server/utils/auth'
import {
  provisionJobs,
  provisionJobLogs,
  type ProvisionJob,
  type ProvisionJobLog,
} from '#server/database/schema'
import { reconcileProvisionJobWithGitHub } from '#server/utils/provision-job-reconciliation'

const LOGS_PER_JOB = 200

/**
 * GET /api/fleet/provision-ui/jobs
 *
 * Lists all provision jobs, most recent first. Session-auth'd for the browser UI.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const db = useDatabase(event)
  const jobs: ProvisionJob[] = await db
    .select()
    .from(provisionJobs)
    .orderBy(desc(provisionJobs.createdAt))
    .limit(50)
    .all()

  if (jobs.length === 0) return { jobs: [] }

  const reconciledJobs = await Promise.all(
    jobs.map((job) => reconcileProvisionJobWithGitHub(event, job)),
  )

  const jobIds = reconciledJobs.map((job) => job.id)
  const logRows: ProvisionJobLog[] =
    jobIds.length > 0
      ? await db
          .select()
          .from(provisionJobLogs)
          .where(inArray(provisionJobLogs.provisionId, jobIds))
          .orderBy(desc(provisionJobLogs.createdAt))
          .all()
      : []

  const logsByJob = new Map<string, ProvisionJobLog[]>()
  for (const logRow of logRows) {
    const jobLogs = logsByJob.get(logRow.provisionId) ?? []
    if (jobLogs.length < LOGS_PER_JOB) {
      jobLogs.push(logRow)
      logsByJob.set(logRow.provisionId, jobLogs)
    }
  }

  const jobsWithLogs = reconciledJobs.map((job) => ({
    ...job,
    logs: [...(logsByJob.get(job.id) ?? [])].reverse(),
  }))

  return { jobs: jobsWithLogs }
})
