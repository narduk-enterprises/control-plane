import { eq } from 'drizzle-orm'
import { fleetApps } from '#server/database/schema'
import type { H3Event } from 'h3'

/**
 * Fleet registry + Cloudflare credentials for remote D1 calls.
 * Caller must already have enforced admin auth (e.g. requireAdmin or defineAdminMutation).
 */
export async function resolveFleetD1Targets(
  event: H3Event,
  appName: string,
): Promise<{
  accountId: string
  apiToken: string
  appName: string
  d1DatabaseName: string | null
}> {
  const db = useDatabase(event)
  const existing = await db
    .select({ name: fleetApps.name, d1DatabaseName: fleetApps.d1DatabaseName })
    .from(fleetApps)
    .where(eq(fleetApps.name, appName))
    .limit(1)
    .all()
  if (existing.length === 0) {
    throw createError({ statusCode: 404, message: `App '${appName}' not found in fleet registry.` })
  }

  const config = useRuntimeConfig(event)
  const accountId = config.cloudflareAccountId?.trim()
  const apiToken = config.cloudflareApiToken?.trim()
  if (!accountId || !apiToken) {
    throw createError({
      statusCode: 503,
      message:
        'Cloudflare credentials are not configured on the control plane (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN).',
    })
  }

  return { accountId, apiToken, appName, d1DatabaseName: existing[0]?.d1DatabaseName ?? null }
}
