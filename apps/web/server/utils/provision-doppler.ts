/**
 * Doppler project + secrets provisioning via REST API.
 * All operations are idempotent — safe to call multiple times.
 *
 * Requires a Doppler Workplace-level API token (dp.ct.* or dp.pt.*)
 * stored in 0_global-canonical-tokens and hub-ref'd into control-plane.
 */

const DOPPLER_API_BASE = 'https://api.doppler.com/v3'

function dopplerHeaders(apiToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

/**
 * Create a Doppler project. Idempotent: no-ops if project already exists.
 */
export async function createDopplerProject(
  apiToken: string,
  projectName: string,
  description?: string,
): Promise<{ created: boolean }> {
  const res = await fetch(`${DOPPLER_API_BASE}/projects`, {
    method: 'POST',
    headers: dopplerHeaders(apiToken),
    body: JSON.stringify({
      name: projectName,
      description: description || `${projectName} — auto-provisioned by Control Plane`,
    }),
  })

  if (res.ok) {
    return { created: true }
  }

  // 409 = already exists — idempotent success
  if (res.status === 409) {
    return { created: false }
  }

  const text = await res.text().catch(() => '')
  if (text.includes('already exists')) {
    return { created: false }
  }

  throw new Error(`Doppler project creation failed: ${res.status} ${text}`)
}

/**
 * Bulk set secrets on a Doppler project/config. Overwrites existing values.
 * This is the primary mechanism for hub-spoke secret sync: the Control Plane
 * reads hub values and writes resolved values to the spoke project.
 */
export async function bulkSetSecrets(
  apiToken: string,
  project: string,
  config: string,
  secrets: Record<string, string>,
): Promise<void> {
  if (Object.keys(secrets).length === 0) return

  const res = await fetch(`${DOPPLER_API_BASE}/configs/config/secrets`, {
    method: 'POST',
    headers: dopplerHeaders(apiToken),
    body: JSON.stringify({
      project,
      config,
      secrets,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Doppler secrets set failed: ${res.status} ${text}`)
  }
}

/**
 * Get all secrets for a project/config. Used to read hub values for resolution.
 */
export async function getDopplerSecrets(
  apiToken: string,
  project: string,
  config: string,
): Promise<Record<string, string>> {
  const res = await fetch(
    `${DOPPLER_API_BASE}/configs/config/secrets/download?project=${encodeURIComponent(project)}&config=${encodeURIComponent(config)}&format=json`,
    { headers: dopplerHeaders(apiToken) },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Doppler secrets download failed: ${res.status} ${text}`)
  }

  return (await res.json()) as Record<string, string>
}

/**
 * Create a Doppler service token for CI/CD.
 * Idempotent via delete-then-recreate: always returns a fresh token value.
 *
 * We must delete-then-recreate because Doppler never shows the token value
 * after initial creation. Without the value, we can't set it as a GitHub
 * repo secret on retry.
 */
export async function createDopplerServiceToken(
  apiToken: string,
  project: string,
  config: string,
  tokenName: string,
): Promise<string> {
  // 1. Delete existing token (if any) to force a fresh value
  try {
    await fetch(`${DOPPLER_API_BASE}/configs/config/tokens/token`, {
      method: 'DELETE',
      headers: dopplerHeaders(apiToken),
      body: JSON.stringify({
        project,
        config,
        slug: tokenName,
      }),
    })
    // Ignore errors — token may not exist yet
  } catch {
    // Swallow — deletion failure is fine if token doesn't exist
  }

  // 2. Create fresh token
  const res = await fetch(`${DOPPLER_API_BASE}/configs/config/tokens`, {
    method: 'POST',
    headers: dopplerHeaders(apiToken),
    body: JSON.stringify({
      project,
      config,
      name: tokenName,
      access: 'read',
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Doppler service token creation failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as { token?: { key?: string } }
  if (!data.token?.key) {
    throw new Error('Doppler service token created but no key in response')
  }

  return data.token.key
}

/**
 * Resolve hub secrets and sync them to a spoke project.
 * Reads actual values from the hub project and writes them to the spoke.
 *
 * Hub secrets: shared infrastructure credentials (CF, PostHog, GSC, etc.)
 * Per-app secrets: app-specific values (APP_NAME, SITE_URL, random tokens)
 *
 * IMPORTANT: Per-app secrets are only set if they don't already exist in the
 * spoke, preventing overwrites of CRON_SECRET/NUXT_SESSION_PASSWORD on retries.
 * Hub secrets are always synced (overwritten) to ensure spoke stays in sync.
 */
export async function syncHubSecrets(
  apiToken: string,
  hubProject: string,
  hubConfig: string,
  spokeProject: string,
  spokeConfig: string,
  perAppSecrets: Record<string, string>,
): Promise<{ synced: number }> {
  // Read resolved values from hub
  const hubSecrets = await getDopplerSecrets(apiToken, hubProject, hubConfig)

  // Read existing spoke secrets to avoid clobbering per-app values
  let existingSpokeSecrets: Record<string, string> = {}
  try {
    existingSpokeSecrets = await getDopplerSecrets(apiToken, spokeProject, spokeConfig)
  } catch {
    // If the config doesn't exist yet (fresh project), that's fine — set everything
  }

  // Hub keys to sync (matching init.ts hub ref list)
  const hubKeysToSync = [
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID',
    'CONTROL_PLANE_API_KEY',
    'POSTHOG_PUBLIC_KEY',
    'POSTHOG_PROJECT_ID',
    'POSTHOG_HOST',
    'POSTHOG_PERSONAL_API_KEY',
    'GA_ACCOUNT_ID',
    'GSC_SERVICE_ACCOUNT_JSON',
    'GSC_USER_EMAIL',
    'APPLE_KEY_ID',
    'APPLE_SECRET_KEY',
    'APPLE_TEAM_ID',
    'CSP_SCRIPT_SRC',
    'CSP_CONNECT_SRC',
  ]

  const secretsToSet: Record<string, string> = {}

  // Hub secrets: always sync (overwrite) to keep spoke in sync with hub
  for (const key of hubKeysToSync) {
    if (hubSecrets[key]) {
      secretsToSet[key] = hubSecrets[key]
    }
  }

  // Per-app secrets: only set if MISSING in spoke (don't clobber existing values)
  for (const [key, value] of Object.entries(perAppSecrets)) {
    if (!existingSpokeSecrets[key]) {
      secretsToSet[key] = value
    }
  }

  if (Object.keys(secretsToSet).length > 0) {
    await bulkSetSecrets(apiToken, spokeProject, spokeConfig, secretsToSet)
  }

  return { synced: Object.keys(secretsToSet).length }
}
