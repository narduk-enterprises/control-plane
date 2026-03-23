import { z } from 'zod'
import { readBody } from 'h3'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { fleetApps } from '#server/database/schema'
import { invalidateFleetAppListCache } from '#server/data/fleet-registry'

const bodySchema = z.object({
  url: z.string().url().optional(),
  dopplerProject: z.string().min(1).optional(),
  gaPropertyId: z.string().nullish(),
  gaMeasurementId: z.string().nullish(),
  posthogAppName: z.string().nullish(),
  githubRepo: z.string().nullish(),
  isActive: z.boolean().optional(),
})

/**
 * PUT /api/fleet/apps/[name]
 * Update an existing fleet app in the registry.
 */
export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'fleet-apps', 20, 60_000)
  await requireAdmin(event)

  const appName = getRouterParam(event, 'name')
  if (!appName) throw createError({ statusCode: 400, message: 'Missing app name' })

  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: `Validation error: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    })
  }

  const db = useDatabase(event)

  // Check app exists
  const existing = await db
    .select()
    .from(fleetApps)
    .where(eq(fleetApps.name, appName))
    .limit(1)
    .all()
  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: `App '${appName}' not found.` })
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (parsed.data.url !== undefined) updates.url = parsed.data.url
  if (parsed.data.dopplerProject !== undefined) updates.dopplerProject = parsed.data.dopplerProject
  if (parsed.data.gaPropertyId !== undefined)
    updates.gaPropertyId = parsed.data.gaPropertyId ?? null
  if (parsed.data.gaMeasurementId !== undefined)
    updates.gaMeasurementId = parsed.data.gaMeasurementId ?? null
  if (parsed.data.posthogAppName !== undefined)
    updates.posthogAppName = parsed.data.posthogAppName ?? null
  if (parsed.data.githubRepo !== undefined) updates.githubRepo = parsed.data.githubRepo ?? null
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive

  await db.update(fleetApps).set(updates).where(eq(fleetApps.name, appName))
  await invalidateFleetAppListCache(event)

  return { ok: true, app: appName }
})
