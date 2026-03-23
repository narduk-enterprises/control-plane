import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { defineAdminMutation, readValidatedMutationBody } from '#layer/server/utils/mutation'
import { fleetApps } from '#server/database/schema'
import { invalidateFleetAppListCache } from '#server/data/fleet-registry'

const bodySchema = z.object({
  url: z.string().url().optional(),
  dopplerProject: z.string().min(1).optional(),
  nuxtPort: z.union([z.coerce.number().int().min(1024).max(65535), z.null()]).optional(),
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
export default defineAdminMutation(
  {
    rateLimit: { namespace: 'fleet-apps', maxRequests: 20, windowMs: 60_000 },
    parseBody: async (event) => readValidatedMutationBody(event, bodySchema.parse),
  },
  async ({ event, body }) => {
    const appName = getRouterParam(event, 'name')
    if (!appName) throw createError({ statusCode: 400, message: 'Missing app name' })

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
    if (body.url !== undefined) updates.url = body.url
    if (body.dopplerProject !== undefined) updates.dopplerProject = body.dopplerProject
    if (body.nuxtPort !== undefined) {
      const conflicts = await db
        .select({ name: fleetApps.name, nuxtPort: fleetApps.nuxtPort })
        .from(fleetApps)
        .all()
      if (
        body.nuxtPort !== null &&
        conflicts.some((app) => app.name !== appName && app.nuxtPort === body.nuxtPort)
      ) {
        throw createError({
          statusCode: 409,
          message: `NUXT_PORT '${body.nuxtPort}' is already assigned to another app.`,
        })
      }
      updates.nuxtPort = body.nuxtPort
    }
    if (body.gaPropertyId !== undefined) updates.gaPropertyId = body.gaPropertyId ?? null
    if (body.gaMeasurementId !== undefined) updates.gaMeasurementId = body.gaMeasurementId ?? null
    if (body.posthogAppName !== undefined) updates.posthogAppName = body.posthogAppName ?? null
    if (body.githubRepo !== undefined) updates.githubRepo = body.githubRepo ?? null
    if (body.isActive !== undefined) updates.isActive = body.isActive

    await db.update(fleetApps).set(updates).where(eq(fleetApps.name, appName))
    await invalidateFleetAppListCache(event)

    return { ok: true, app: appName }
  },
)
