import { desc } from 'drizzle-orm'
import { requireAdmin } from '#layer/server/utils/auth'
import { provisionJobs } from '#server/database/schema'

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

  return { jobs }
})
