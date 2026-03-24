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
const DEFAULT_RETRYABLE_STATUSES = new Set([404, 408, 409, 425, 429, 500, 502, 503, 504])

function dopplerHeaders(apiToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAlreadyInUseMessage(text: string): boolean {
  return /already exists|name is already in use/i.test(text)
}

function retryDelayMs(attempt: number): number {
  return 250 * 2 ** attempt
}

async function dopplerFetch(
  apiToken: string,
  path: string,
  init: RequestInit,
  options: {
    retries?: number
    retryableStatuses?: Set<number>
  } = {},
): Promise<Response> {
  void apiToken
  const retries = options.retries ?? 2
  const retryableStatuses = options.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES

  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(path, init)
      if (res.ok || attempt === retries || !retryableStatuses.has(res.status)) {
        return res
      }
    } catch (error) {
      lastError = error
      if (attempt === retries) {
        throw error
      }
    }

    await wait(retryDelayMs(attempt))
  }

  throw lastError instanceof Error ? lastError : new Error('Doppler request failed')
}

async function dopplerProjectExists(apiToken: string, project: string): Promise<boolean> {
  const res = await dopplerFetch(
    apiToken,
    `${DOPPLER_API_BASE}/projects/project?project=${encodeURIComponent(project)}`,
    {
      headers: dopplerHeaders(apiToken),
    },
    { retries: 1, retryableStatuses: new Set([408, 425, 429, 500, 502, 503, 504]) },
  )

  if (res.ok) {
    return true
  }

  if (res.status === 404) {
    return false
  }

  const text = await res.text().catch(() => '')
  throw new Error(`Doppler project lookup failed for ${project}: ${res.status} ${text}`)
}

async function dopplerConfigExists(
  apiToken: string,
  project: string,
  config: string,
): Promise<boolean> {
  const res = await dopplerFetch(
    apiToken,
    `${DOPPLER_API_BASE}/configs/config?project=${encodeURIComponent(project)}&config=${encodeURIComponent(config)}`,
    {
      headers: dopplerHeaders(apiToken),
    },
    { retries: 1, retryableStatuses: new Set([408, 425, 429, 500, 502, 503, 504]) },
  )

  if (res.ok) {
    return true
  }

  if (res.status === 404) {
    return false
  }

  const text = await res.text().catch(() => '')
  throw new Error(`Doppler config lookup failed for ${project}/${config}: ${res.status} ${text}`)
}

/**
 * Create a Doppler project. Idempotent: no-ops if project already exists.
 */
export async function createDopplerProject(
  apiToken: string,
  projectName: string,
  description?: string,
): Promise<{ created: boolean }> {
  const res = await dopplerFetch(
    apiToken,
    `${DOPPLER_API_BASE}/projects`,
    {
      method: 'POST',
      headers: dopplerHeaders(apiToken),
      body: JSON.stringify({
        name: projectName,
        description: description || `${projectName} — auto-provisioned by Control Plane`,
      }),
    },
    { retries: 2, retryableStatuses: new Set([408, 425, 429, 500, 502, 503, 504]) },
  )

  if (res.ok) {
    return { created: true }
  }

  // 409 = already exists — idempotent success
  if (res.status === 409) {
    return { created: false }
  }

  const text = await res.text().catch(() => '')
  if (isAlreadyInUseMessage(text)) {
    for (const delayMs of [0, 300, 1_000]) {
      if (delayMs > 0) {
        await wait(delayMs)
      }

      if (await dopplerProjectExists(apiToken, projectName)) {
        return { created: false }
      }
    }
  }

  throw new Error(`Doppler project creation failed: ${res.status} ${text}`)
}

/**
 * Create a Doppler branch config within a project environment.
 * Idempotent: no-ops if the config already exists.
 */
export async function createDopplerConfig(
  apiToken: string,
  project: string,
  name: string,
  environment: string,
): Promise<{ created: boolean }> {
  const res = await dopplerFetch(
    apiToken,
    `${DOPPLER_API_BASE}/configs?project=${encodeURIComponent(project)}`,
    {
      method: 'POST',
      headers: dopplerHeaders(apiToken),
      body: JSON.stringify({
        name,
        environment,
      }),
    },
    { retries: 2, retryableStatuses: new Set([408, 425, 429, 500, 502, 503, 504]) },
  )

  if (res.ok) {
    return { created: true }
  }

  if (res.status === 409) {
    return { created: false }
  }

  const text = await res.text().catch(() => '')
  if (isAlreadyInUseMessage(text)) {
    for (const delayMs of [0, 300, 1_000]) {
      if (delayMs > 0) {
        await wait(delayMs)
      }

      if (await dopplerConfigExists(apiToken, project, name)) {
        return { created: false }
      }
    }
  }

  throw new Error(`Doppler config creation failed for ${project}/${name}: ${res.status} ${text}`)
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

  const res = await dopplerFetch(apiToken, `${DOPPLER_API_BASE}/configs/config/secrets`, {
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

  const res = await dopplerFetch(apiToken, `${DOPPLER_API_BASE}/configs/config/secrets`, {
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
  const res = await dopplerFetch(
    apiToken,
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
    await dopplerFetch(
      apiToken,
      `${DOPPLER_API_BASE}/configs/config/tokens/token`,
      {
        method: 'DELETE',
        headers: dopplerHeaders(apiToken),
        body: JSON.stringify({
          project,
          config,
          slug: tokenName,
        }),
      },
      { retries: 1, retryableStatuses: new Set([404, 408, 425, 429, 500, 502, 503, 504]) },
    )
    // Ignore errors — token may not exist yet
  } catch {
    // Swallow — deletion failure is fine if token doesn't exist
  }

  // 2. Create fresh token
  let res = await dopplerFetch(
    apiToken,
    `${DOPPLER_API_BASE}/configs/config/tokens`,
    {
      method: 'POST',
      headers: dopplerHeaders(apiToken),
      body: JSON.stringify({
        project,
        config,
        name: tokenName,
        access: 'read',
      }),
    },
    { retries: 2, retryableStatuses: new Set([404, 408, 425, 429, 500, 502, 503, 504]) },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (isAlreadyInUseMessage(text)) {
      await wait(500)
      res = await dopplerFetch(
        apiToken,
        `${DOPPLER_API_BASE}/configs/config/tokens`,
        {
          method: 'POST',
          headers: dopplerHeaders(apiToken),
          body: JSON.stringify({
            project,
            config,
            name: tokenName,
            access: 'read',
          }),
        },
        { retries: 2, retryableStatuses: new Set([404, 408, 425, 429, 500, 502, 503, 504]) },
      )
    } else {
      throw new Error(`Doppler service token creation failed: ${res.status} ${text}`)
    }
  }

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
  const res = await dopplerFetch(apiToken, `${DOPPLER_API_BASE}/configs/config/inheritable`, {
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
  const res = await dopplerFetch(apiToken, `${DOPPLER_API_BASE}/configs/config/inherits`, {
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
 * Establishes a flat inheritance link: spoke/prd → hub/prd.
 *
 * Doppler constraint: inheritable configs cannot also inherit. So spoke/prd
 * is NOT marked inheritable — it only inherits from hub/prd.
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
  // 1. Ensure hub config is marked inheritable
  await setConfigInheritable(apiToken, hubProject, hubConfig, true)

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
 * Populate the `dev` config using **Config Inheritance** from hub/prd directly.
 * Doppler constraint: inheritable configs cannot also inherit, so spoke/prd
 * cannot be both inheritable and an inheriting child. Dev inherits hub/prd
 * directly (flat pattern), and per-app secrets are set directly in dev.
 */
export async function syncDevConfig(
  apiToken: string,
  hubProject: string,
  hubConfig: string,
  spokeProject: string,
  perAppSecrets: Record<string, string>,
  options: { siteUrl?: string } = {},
): Promise<{ synced: number }> {
  // 1. Link spoke/dev → hub/prd (flat inheritance — hub secrets flow directly)
  await setConfigInherits(apiToken, spokeProject, 'dev', [
    { project: hubProject, config: hubConfig },
  ])

  // 2. Read existing dev secrets to avoid clobbering
  let existingDevSecrets: Record<string, string> = {}
  try {
    existingDevSecrets = await getDopplerSecrets(apiToken, spokeProject, 'dev')
  } catch {
    // Fresh project — set everything
  }

  // 3. Set per-app secrets + dev-specific overrides
  const secretsToSet: Record<string, string> = {}
  const DEV_KEYS_TO_ALWAYS_SYNC = new Set(['APP_NAME', 'SITE_URL', 'NUXT_PORT'])

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

/**
 * Populate the Copilot config using the same flat inheritance pattern as the
 * rest of provisioning, then overlay the agent-only direct secrets.
 */
export async function syncCopilotConfig(
  apiToken: string,
  hubProject: string,
  hubConfig: string,
  spokeProject: string,
  copilotConfig: string,
  secrets: Record<string, string>,
): Promise<{ synced: number }> {
  await setConfigInherits(apiToken, spokeProject, copilotConfig, [
    { project: hubProject, config: hubConfig },
  ])

  if (Object.keys(secrets).length > 0) {
    await bulkSetSecrets(apiToken, spokeProject, copilotConfig, secrets)
  }

  return { synced: Object.keys(secrets).length }
}
