/**
 * Doppler project + secrets provisioning via REST API.
 * All operations are idempotent — safe to call multiple times.
 *
 * Uses Config Inheritance to share hub secrets with spoke projects,
 * eliminating the need for cross-project reference strings.
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
 * Delete specific secrets from a Doppler project/config.
 * Used during migration to remove old cross-project reference strings.
 */
export async function deleteSecrets(
  apiToken: string,
  project: string,
  config: string,
  keys: string[],
): Promise<void> {
  if (keys.length === 0) return

  // Doppler's bulk set with empty string doesn't delete — use the delete endpoint
  const secrets: Record<string, null> = {}
  for (const key of keys) {
    secrets[key] = null
  }

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
    throw new Error(`Doppler secrets delete failed: ${res.status} ${text}`)
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

// ─── Config Inheritance API ─────────────────────────────────────────────────

/**
 * Mark a config as inheritable so other configs can inherit from it.
 * Idempotent: safe to call multiple times.
 *
 * POST /v3/configs/config/inheritable
 */
export async function setConfigInheritable(
  apiToken: string,
  project: string,
  config: string,
  inheritable: boolean = true,
): Promise<void> {
  const res = await fetch(`${DOPPLER_API_BASE}/configs/config/inheritable`, {
    method: 'POST',
    headers: dopplerHeaders(apiToken),
    body: JSON.stringify({ project, config, inheritable }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Failed to set config ${project}/${config} inheritable=${inheritable}: ${res.status} ${text}`,
    )
  }
}

/**
 * Set config inheritance: child config will inherit ALL secrets from parent configs.
 * Replaces any existing inheritance configuration (PUT semantics).
 *
 * POST /v3/configs/config/inherits
 */
export async function setConfigInherits(
  apiToken: string,
  childProject: string,
  childConfig: string,
  parentConfigs: Array<{ project: string; config: string }>,
): Promise<void> {
  const res = await fetch(`${DOPPLER_API_BASE}/configs/config/inherits`, {
    method: 'POST',
    headers: dopplerHeaders(apiToken),
    body: JSON.stringify({
      project: childProject,
      config: childConfig,
      inherits: parentConfigs,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Failed to set inheritance for ${childProject}/${childConfig}: ${res.status} ${text}`,
    )
  }
}

/**
 * Sync hub secrets to a spoke project using **Config Inheritance**.
 * Instead of writing cross-project reference strings, establishes an inheritance
 * link so all hub secrets flow automatically.
 *
 * Hub secrets: flow via inheritance (automatic).
 * Per-app secrets: APP_NAME/SITE_URL are always synced; generated secrets
 * (CRON_SECRET, NUXT_SESSION_PASSWORD) are only set if missing.
 */
export async function syncHubSecrets(
  apiToken: string,
  hubProject: string,
  hubConfig: string,
  spokeProject: string,
  spokeConfig: string,
  perAppSecrets: Record<string, string>,
): Promise<{ synced: number }> {
  // 1. Mark spoke/prd as inheritable (so spoke/dev can inherit from it)
  await setConfigInheritable(apiToken, spokeProject, spokeConfig, true)

  // 2. Link spoke/prd → hub/prd (all hub secrets flow automatically)
  await setConfigInherits(apiToken, spokeProject, spokeConfig, [
    { project: hubProject, config: hubConfig },
  ])

  // 3. Read existing spoke secrets to avoid clobbering per-app values
  let existingSpokeSecrets: Record<string, string> = {}
  try {
    existingSpokeSecrets = await getDopplerSecrets(apiToken, spokeProject, spokeConfig)
  } catch {
    // If the config doesn't exist yet (fresh project), that's fine — set everything
  }

  // 4. Set per-app secrets only (hub secrets are now inherited)
  const secretsToSet: Record<string, string> = {}
  const PER_APP_KEYS_TO_ALWAYS_SYNC = new Set(['APP_NAME', 'SITE_URL'])

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
 * Populate the `dev` config using **Config Inheritance** from spoke/prd.
 * All hub secrets and per-app secrets chain down: hub/prd → spoke/prd → spoke/dev.
 * Only SITE_URL (localhost) and NUXT_PORT need to be set directly in dev.
 */
export async function syncDevConfig(
  apiToken: string,
  _hubProject: string,
  _hubConfig: string,
  spokeProject: string,
  perAppSecrets: Record<string, string>,
  options: { siteUrl?: string } = {},
): Promise<{ synced: number }> {
  // 1. Link spoke/dev → spoke/prd (hub secrets chain through: hub/prd → spoke/prd → spoke/dev)
  await setConfigInherits(apiToken, spokeProject, 'dev', [
    { project: spokeProject, config: 'prd' },
  ])

  // 2. Read existing dev secrets to avoid clobbering
  let existingDevSecrets: Record<string, string> = {}
  try {
    existingDevSecrets = await getDopplerSecrets(apiToken, spokeProject, 'dev')
  } catch {
    // Fresh project — set everything
  }

  // 3. Only set dev-specific overrides (everything else comes via inheritance)
  const secretsToSet: Record<string, string> = {}
  const DEV_KEYS_TO_ALWAYS_SYNC = new Set(['SITE_URL', 'NUXT_PORT'])

  const devAppSecrets = {
    SITE_URL: options.siteUrl || 'http://localhost:3000',
    NUXT_PORT: perAppSecrets.NUXT_PORT || '3000',
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
