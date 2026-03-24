import { inArray, desc } from 'drizzle-orm'
import { requireAdmin } from '#layer/server/utils/auth'
import { provisionJobs, provisionJobLogs } from '#server/database/schema'

const LOGS_PER_JOB = 200
const MAX_TOTAL_LOG_ROWS = 5000

/**
 * GET /api/fleet/provision-ui/jobs
 *
 * Lists all provision jobs, most recent first. Session-auth'd for the browser UI.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const db = useDatabase(event)
  const jobs = await db
    .select()
    .from(provisionJobs)
    .orderBy(desc(provisionJobs.createdAt))
    .limit(50)
    .all()

  if (jobs.length === 0) return { jobs: [] }

  const jobIds = jobs.map((j) => j.id)
  const logRows = await db
    .select()
    .from(provisionJobLogs)
    .where(inArray(provisionJobLogs.provisionId, jobIds))
    .orderBy(desc(provisionJobLogs.createdAt))
    .limit(MAX_TOTAL_LOG_ROWS)
    .all()

  const byJob = new Map<string, typeof logRows>()
  for (const row of logRows) {
    const list = byJob.get(row.provisionId)
    if (list) {
      if (list.length < LOGS_PER_JOB) list.push(row)
    } else {
      byJob.set(row.provisionId, [row])
    }
  }

  const jobsWithLogs = jobs.map((j) => ({
    ...j,
    logs: [...(byJob.get(j.id) ?? [])].reverse(),
  }))

  return { jobs: jobsWithLogs }
})
