import { appStatus } from '#server/database/schema'
import { sql } from 'drizzle-orm'

/**
 * GET /api/fleet/indexnow/summary
 * 
 * Returns aggregate IndexNow stats across the fleet.
 */
export default defineEventHandler(async (event) => {
  const db = useDatabase(event)
  
  const [result] = await db.select({
    totalSubmissions: sql<number>`SUM(${appStatus.indexnowTotalSubmissions})`,
    appsWithIndexnow: sql<number>`COUNT(CASE WHEN ${appStatus.indexnowLastSubmission} IS NOT NULL THEN 1 END)`,
    totalFleetSize: sql<number>`COUNT(*)`,
  }).from(appStatus).all()

  return {
    totalSubmissions: Number(result?.totalSubmissions ?? 0),
    appsWithIndexnow: Number(result?.appsWithIndexnow ?? 0),
    totalFleetSize: Number(result?.totalFleetSize ?? 0),
  }
})
