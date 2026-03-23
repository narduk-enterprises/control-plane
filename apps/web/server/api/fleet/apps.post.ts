import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { defineAdminMutation, readValidatedMutationBody } from '#layer/server/utils/mutation'
import { fleetApps } from '#server/database/schema'
import { invalidateFleetAppListCache } from '#server/data/fleet-registry'
import { allocateFleetNuxtPort } from '#server/utils/nuxt-port'

const bodySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Must be lowercase alphanumeric with hyphens'),
  url: z.string().url(),
  dopplerProject: z.string().min(1).optional(),
  nuxtPort: z.coerce.number().int().min(1024).max(65535).optional(),
  gaPropertyId: z.string().nullish(),
  gaMeasurementId: z.string().nullish(),
  posthogAppName: z.string().nullish(),
  githubRepo: z.string().nullish(),
  isActive: z.boolean().optional().default(true),
})

/**
 * POST /api/fleet/apps
 * Add a new fleet app to the registry.
 */
export default defineAdminMutation(
  {
    rateLimit: { namespace: 'fleet-apps', maxRequests: 20, windowMs: 60_000 },
    parseBody: async (event) => readValidatedMutationBody(event, bodySchema.parse),
  },
  async ({ event, body }) => {
    const {
      name,
      url,
      nuxtPort,
      gaPropertyId,
      gaMeasurementId,
      posthogAppName,
      githubRepo,
      isActive,
    } = body
    const dopplerProject = body.dopplerProject ?? name
    const now = new Date().toISOString()

    const db = useDatabase(event)

    // Check for existing app
    const existing = await db
      .select()
      .from(fleetApps)
      .where(eq(fleetApps.name, name))
      .limit(1)
      .all()
    if (existing.length > 0) {
      throw createError({ statusCode: 409, message: `App '${name}' already exists.` })
    }

    const otherApps = await db.select({ nuxtPort: fleetApps.nuxtPort }).from(fleetApps).all()
    const resolvedNuxtPort =
      nuxtPort !== undefined
        ? nuxtPort
        : allocateFleetNuxtPort(otherApps.map((app) => app.nuxtPort))

    if (
      nuxtPort !== undefined &&
      otherApps.some((app) => app.nuxtPort !== null && app.nuxtPort === resolvedNuxtPort)
    ) {
      throw createError({
        statusCode: 409,
        message: `NUXT_PORT '${resolvedNuxtPort}' is already assigned to another app.`,
      })
    }

    await db.insert(fleetApps).values({
      name,
      url,
      dopplerProject,
      nuxtPort: resolvedNuxtPort,
      gaPropertyId: gaPropertyId ?? null,
      gaMeasurementId: gaMeasurementId ?? null,
      posthogAppName: posthogAppName ?? null,
      githubRepo: githubRepo ?? null,
      isActive,
      createdAt: now,
      updatedAt: now,
    })

    await invalidateFleetAppListCache(event)

    return { ok: true, app: name, nuxtPort: resolvedNuxtPort }
  },
)
