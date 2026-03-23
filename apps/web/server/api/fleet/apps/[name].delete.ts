import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { fleetApps } from '#server/database/schema'
import { invalidateFleetAppListCache } from '#server/data/fleet-registry'

const querySchema = z.object({
  hard: z.enum(['true', 'false']).optional(),
})

/**
 * DELETE /api/fleet/apps/[name]
 * Soft-delete a fleet app (sets is_active = false).
 * Pass ?hard=true to permanently delete.
 */
export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'fleet-apps', 10, 60_000)
  await requireAdmin(event)

  const appName = getRouterParam(event, 'name')
  if (!appName) throw createError({ statusCode: 400, message: 'Missing app name' })

  const db = useDatabase(event)

  const existing = await db
    .select()
    .from(fleetApps)
    .where(eq(fleetApps.name, appName))
    .limit(1)
    .all()
  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: `App '${appName}' not found.` })
  }

  const rawQuery = getQuery(event)
  const query = querySchema.parse(rawQuery)

  if (query.hard === 'true') {
    await db.delete(fleetApps).where(eq(fleetApps.name, appName))
    await invalidateFleetAppListCache(event)
    return { ok: true, app: appName, action: 'deleted' }
  }

  await db
    .update(fleetApps)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(eq(fleetApps.name, appName))
  await invalidateFleetAppListCache(event)
  return { ok: true, app: appName, action: 'deactivated' }
})
