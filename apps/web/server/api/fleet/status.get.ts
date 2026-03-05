import { appStatus } from '#server/database/schema'
import { z } from 'zod'

/**
 * GET /api/fleet/status
 *
 * Returns all cached fleet app statuses from the D1 database.
 * If no statuses exist yet, automatically triggers a full status check
 * to populate the table (first-run / fresh migration scenario).
 */
export default defineEventHandler(async (event) => {
    const queryParams = await getValidatedQuery(event, z.object({
        force: z.enum(['true', 'false']).optional(),
    }).parse)

    const db = useDatabase(event)

    if (queryParams.force !== 'true') {
        const rows = await db.select().from(appStatus).all()
        if (rows.length > 0) return rows
    }

    // No cached data or forced — run the checks now and return fresh results
    return checkAllFleetStatuses(event)
})
