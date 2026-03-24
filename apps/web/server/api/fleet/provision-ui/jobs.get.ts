import { eq, desc } from 'drizzle-orm'
import { requireAdmin } from '#layer/server/utils/auth'
import { provisionJobs, provisionJobLogs } from '#server/database/schema'

const LOGS_PER_JOB = 200

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

  const jobsWithLogs = await Promise.all(
    jobs.map(async (j) => {
      const logRows = await db
        .select()
        .from(provisionJobLogs)
        .where(eq(provisionJobLogs.provisionId, j.id))
        .orderBy(desc(provisionJobLogs.createdAt))
        .limit(LOGS_PER_JOB)
        .all()
      return {
        ...j,
        logs: [...logRows].reverse(),
      }
    }),
  )

  return { jobs: jobsWithLogs }
})
