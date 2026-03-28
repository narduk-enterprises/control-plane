import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { defineAdminMutation, readValidatedMutationBody } from '#layer/server/utils/mutation'
import { fleetApps } from '#server/database/schema'
import {
  parseFleetAuthProviders,
  resolveFleetAuthConfig,
  serializeFleetAuthProviders,
  validateFleetAuthConfig,
} from '#server/data/fleet-auth'
import { invalidateFleetAppListCache } from '#server/data/fleet-registry'

const bodySchema = z.object({
  url: z.string().url().optional(),
  dopplerProject: z.string().min(1).optional(),
  databaseBackend: z.enum(['d1', 'postgres']).optional(),
  d1DatabaseName: z.string().min(1).max(128).nullish(),
  nuxtPort: z.union([z.coerce.number().int().min(1024).max(65535), z.null()]).optional(),
  gaPropertyId: z.string().nullish(),
  gaMeasurementId: z.string().nullish(),
  posthogAppName: z.string().nullish(),
  githubRepo: z.string().nullish(),
  authEnabled: z.boolean().optional(),
  redirectBaseUrl: z.string().url().nullish(),
  loginPath: z.string().min(1).optional(),
  callbackPath: z.string().min(1).optional(),
  logoutPath: z.string().min(1).optional(),
  confirmPath: z.string().min(1).optional(),
  resetPath: z.string().min(1).optional(),
  publicSignup: z.boolean().optional(),
  providers: z.array(z.enum(['apple', 'email'])).optional(),
  requireMfa: z.boolean().optional(),
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

    const current = existing[0]
    const auth = resolveFleetAuthConfig({
      authEnabled: body.authEnabled ?? current.authEnabled,
      redirectBaseUrl: body.redirectBaseUrl ?? current.redirectBaseUrl ?? body.url ?? current.url,
      loginPath: body.loginPath ?? current.loginPath,
      callbackPath: body.callbackPath ?? current.callbackPath,
      logoutPath: body.logoutPath ?? current.logoutPath,
      confirmPath: body.confirmPath ?? current.confirmPath,
      resetPath: body.resetPath ?? current.resetPath,
      publicSignup: body.publicSignup ?? current.publicSignup,
      providers: body.providers ?? parseFleetAuthProviders(current.providers),
      requireMfa: body.requireMfa ?? current.requireMfa,
    })
    const authIssues = validateFleetAuthConfig(appName, auth)
    if (authIssues.length > 0) {
      throw createError({ statusCode: 400, message: authIssues.join('; ') })
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (body.url !== undefined) updates.url = body.url
    if (body.dopplerProject !== undefined) updates.dopplerProject = body.dopplerProject
    if (body.databaseBackend !== undefined) {
      updates.databaseBackend = body.databaseBackend
      if (body.databaseBackend === 'postgres') {
        updates.d1DatabaseName = null
      } else if (body.d1DatabaseName !== undefined) {
        updates.d1DatabaseName = body.d1DatabaseName?.trim() || `${appName}-db`
      } else if (!current.d1DatabaseName) {
        updates.d1DatabaseName = `${appName}-db`
      }
    } else if (body.d1DatabaseName !== undefined) {
      const effectiveBackend = current.databaseBackend === 'postgres' ? 'postgres' : 'd1'
      updates.d1DatabaseName =
        effectiveBackend === 'postgres' ? null : body.d1DatabaseName?.trim() || `${appName}-db`
    }
    if (body.nuxtPort !== undefined) {
      const conflicts: Array<{ name: string; nuxtPort: number | null }> = await db
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
    if (body.authEnabled !== undefined) updates.authEnabled = auth.authEnabled
    if (
      body.redirectBaseUrl !== undefined ||
      body.url !== undefined ||
      body.loginPath !== undefined ||
      body.callbackPath !== undefined ||
      body.logoutPath !== undefined ||
      body.confirmPath !== undefined ||
      body.resetPath !== undefined ||
      body.publicSignup !== undefined ||
      body.providers !== undefined ||
      body.requireMfa !== undefined
    ) {
      updates.redirectBaseUrl = auth.redirectBaseUrl
      updates.loginPath = auth.loginPath
      updates.callbackPath = auth.callbackPath
      updates.logoutPath = auth.logoutPath
      updates.confirmPath = auth.confirmPath
      updates.resetPath = auth.resetPath
      updates.publicSignup = auth.publicSignup
      updates.providers = serializeFleetAuthProviders(auth.providers)
      updates.requireMfa = auth.requireMfa
    }
    if (body.isActive !== undefined) updates.isActive = body.isActive

    await db.update(fleetApps).set(updates).where(eq(fleetApps.name, appName))
    await invalidateFleetAppListCache(event)

    return { ok: true, app: appName }
  },
)
