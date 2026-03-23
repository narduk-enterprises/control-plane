import { z } from 'zod'
import { readBody } from 'h3'
import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { fleetApps } from '#server/database/schema'
import { invalidateFleetAppListCache } from '#server/data/fleet-registry'

const bodySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Must be lowercase alphanumeric with hyphens'),
  url: z.string().url(),
  dopplerProject: z.string().min(1).optional(),
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
export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'fleet-apps', 20, 60_000)
  await requireAdmin(event)

  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: `Validation error: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    })
  }

  const { name, url, gaPropertyId, gaMeasurementId, posthogAppName, githubRepo, isActive } =
    parsed.data
  const dopplerProject = parsed.data.dopplerProject ?? name
  const now = new Date().toISOString()

  const db = useDatabase(event)

  // Check for existing app
  const existing = await db
    .select()
    .from(fleetApps)
    .where((await import('drizzle-orm')).eq(fleetApps.name, name))
    .limit(1)
    .all()
  if (existing.length > 0) {
    throw createError({ statusCode: 409, message: `App '${name}' already exists.` })
  }

  await db.insert(fleetApps).values({
    name,
    url,
    dopplerProject,
    gaPropertyId: gaPropertyId ?? null,
    gaMeasurementId: gaMeasurementId ?? null,
    posthogAppName: posthogAppName ?? null,
    githubRepo: githubRepo ?? null,
    isActive,
    createdAt: now,
    updatedAt: now,
  })

  await invalidateFleetAppListCache(event)

  return { ok: true, app: name }
})
