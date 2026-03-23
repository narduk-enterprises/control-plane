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
 * Supports both plain values and cross-project reference syntax
 * (e.g. `${narduk-nuxt-template.prd.KEY}`).
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

/** Hub keys that should use cross-project references (matching init.ts hub ref list). */
const HUB_KEYS_TO_SYNC = [
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'CONTROL_PLANE_API_KEY',
  'GITHUB_TOKEN_PACKAGES_READ',
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

/**
 * Sync hub secrets to a spoke project using **cross-project references**.
 * Instead of copying resolved values, writes Doppler cross-project reference
 * syntax (`${hub.config.KEY}`) so spoke secrets stay in sync automatically
 * when hub values rotate.
 *
 * Hub secrets: always synced as cross-project references (overwritten).
 * Per-app secrets: APP_NAME/SITE_URL are always synced; secret values are only
 * set if missing so retries do not rotate them unexpectedly.
 */
export async function syncHubSecrets(
  apiToken: string,
  hubProject: string,
  hubConfig: string,
  spokeProject: string,
  spokeConfig: string,
  perAppSecrets: Record<string, string>,
): Promise<{ synced: number }> {
  // Read existing spoke secrets to avoid clobbering per-app values
  let existingSpokeSecrets: Record<string, string> = {}
  try {
    existingSpokeSecrets = await getDopplerSecrets(apiToken, spokeProject, spokeConfig)
  } catch {
    // If the config doesn't exist yet (fresh project), that's fine — set everything
  }

  const secretsToSet: Record<string, string> = {}
  const PER_APP_KEYS_TO_ALWAYS_SYNC = new Set(['APP_NAME', 'SITE_URL'])

  // Hub secrets: write as cross-project references (always overwrite to fix any stale values)
  for (const key of HUB_KEYS_TO_SYNC) {
    secretsToSet[key] = `\${${hubProject}.${hubConfig}.${key}}`
  }

  // Per-app secrets: only set if MISSING in spoke (don't clobber existing values)
  for (const [key, value] of Object.entries(perAppSecrets)) {
    if (PER_APP_KEYS_TO_ALWAYS_SYNC.has(key) || !existingSpokeSecrets[key]) {
      secretsToSet[key] = value
    }
  }

  if (Object.keys(secretsToSet).length > 0) {
    await bulkSetSecrets(apiToken, spokeProject, spokeConfig, secretsToSet)
  }

  return { synced: Object.keys(secretsToSet).length }
}

/**
 * Populate the `dev` config by mirroring hub cross-project references and
 * per-app secrets from `prd`, with SITE_URL overridden to localhost.
 *
 * This ensures `doppler run -- pnpm dev` works immediately after provisioning.
 * APP_NAME, SITE_URL, and NUXT_PORT are always refreshed in `dev`.
 */
export async function syncDevConfig(
  apiToken: string,
  hubProject: string,
  hubConfig: string,
  spokeProject: string,
  perAppSecrets: Record<string, string>,
  options: { siteUrl?: string } = {},
): Promise<{ synced: number }> {
  // Read existing dev secrets to avoid clobbering
  let existingDevSecrets: Record<string, string> = {}
  try {
    existingDevSecrets = await getDopplerSecrets(apiToken, spokeProject, 'dev')
  } catch {
    // Fresh project — set everything
  }

  const secretsToSet: Record<string, string> = {}
  const DEV_KEYS_TO_ALWAYS_SYNC = new Set(['APP_NAME', 'SITE_URL', 'NUXT_PORT'])

  // Hub secrets: same cross-project references as prd
  for (const key of HUB_KEYS_TO_SYNC) {
    secretsToSet[key] = `\${${hubProject}.${hubConfig}.${key}}`
  }

  // Per-app secrets: only set if missing, with SITE_URL override for local dev
  const devAppSecrets = {
    ...perAppSecrets,
    SITE_URL: options.siteUrl || 'http://localhost:3000',
  }
  for (const [key, value] of Object.entries(devAppSecrets)) {
    if (DEV_KEYS_TO_ALWAYS_SYNC.has(key) || !existingDevSecrets[key]) {
      secretsToSet[key] = value
    }
  }

  if (Object.keys(secretsToSet).length > 0) {
    await bulkSetSecrets(apiToken, spokeProject, 'dev', secretsToSet)
  }

  return { synced: Object.keys(secretsToSet).length }
}
