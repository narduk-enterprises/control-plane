import { appStatus } from '#server/database/schema'
import { sql } from 'drizzle-orm'

/**
 * GET /api/fleet/gsc-sitemap/summary
 */
export default defineEventHandler(async (event) => {
  const db = useDatabase(event)

  const [result] = await db
    .select({
      totalSubmissions: sql<number>`SUM(${appStatus.gscSitemapTotalSubmissions})`,
      appsWithSubmission: sql<number>`COUNT(CASE WHEN ${appStatus.gscSitemapLastSubmittedAt} IS NOT NULL THEN 1 END)`,
      totalFleetSize: sql<number>`COUNT(*)`,
    })
    .from(appStatus)
    .all()

  return {
    totalSubmissions: Number(result?.totalSubmissions ?? 0),
    appsWithSubmission: Number(result?.appsWithSubmission ?? 0),
    totalFleetSize: Number(result?.totalFleetSize ?? 0),
  }
})
