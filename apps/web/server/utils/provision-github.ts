/**
 * GitHub repository operations for provisioning.
 * All operations are idempotent — safe to call multiple times.
 *
 * Uses libsodium-wrappers for GitHub Secrets API encryption (sealed boxes).
 */

const GH_API_BASE = 'https://api.github.com'
const GH_API_VERSION = '2022-11-28'
const GH_COPILOT_API_VERSION = '2026-03-10'

type GithubApiVersion = typeof GH_API_VERSION | typeof GH_COPILOT_API_VERSION

export interface GithubWorkflowRun {
  id: number
  htmlUrl: string
  status: string
  conclusion: string | null
}

function ghHeaders(
  token: string,
  apiVersion: GithubApiVersion = GH_API_VERSION,
): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'narduk-control-plane',
    'X-GitHub-Api-Version': apiVersion,
  }
}

interface GithubRepoMetadata {
  id: number
  full_name: string
  owner: {
    login: string
    type: string
  }
}

interface GithubCopilotCodingAgentPermissions {
  enabled_repositories: 'all' | 'selected' | 'none'
}

export type EnableRepoForCopilotCodingAgentResult =
  | 'already_enabled_for_all_repositories'
  | 'enabled_for_selected_repositories'
  | 'disabled_by_org_policy'
  | 'unsupported_for_user_repo'

function splitRepoFullName(repo: string): { owner: string; name: string } {
  const [owner, name, ...rest] = repo.split('/')
  if (!owner || !name || rest.length > 0) {
    throw new Error(`Invalid GitHub repository slug: ${repo}`)
  }

  return { owner, name }
}

async function getRepoMetadata(ghToken: string, repo: string): Promise<GithubRepoMetadata> {
  const { owner, name } = splitRepoFullName(repo)
  const res = await fetch(`${GH_API_BASE}/repos/${owner}/${name}`, {
    headers: ghHeaders(ghToken),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GitHub repo metadata fetch failed: ${res.status} ${text}`)
  }

  return (await res.json()) as GithubRepoMetadata
}

async function getCopilotCodingAgentPermissions(
  ghToken: string,
  org: string,
): Promise<GithubCopilotCodingAgentPermissions> {
  const res = await fetch(`${GH_API_BASE}/orgs/${org}/copilot/coding-agent/permissions`, {
    headers: ghHeaders(ghToken, GH_COPILOT_API_VERSION),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GitHub Copilot coding agent permissions fetch failed: ${res.status} ${text}`)
  }

  return (await res.json()) as GithubCopilotCodingAgentPermissions
}

/**
 * Enable Copilot coding agent for an organization-owned repository when the org policy allows it.
 * Idempotent for org policy `all` and for repositories already enabled under `selected`.
 */
export async function enableRepoForCopilotCodingAgent(
  ghToken: string,
  repo: string,
): Promise<EnableRepoForCopilotCodingAgentResult> {
  const repoMetadata = await getRepoMetadata(ghToken, repo)

  if (repoMetadata.owner.type.toLowerCase() !== 'organization') {
    return 'unsupported_for_user_repo'
  }

  const org = repoMetadata.owner.login
  const permissions = await getCopilotCodingAgentPermissions(ghToken, org)

  if (permissions.enabled_repositories === 'all') {
    return 'already_enabled_for_all_repositories'
  }

  if (permissions.enabled_repositories === 'none') {
    return 'disabled_by_org_policy'
  }

  const res = await fetch(
    `${GH_API_BASE}/orgs/${org}/copilot/coding-agent/permissions/repositories/${repoMetadata.id}`,
    {
      method: 'PUT',
      headers: ghHeaders(ghToken, GH_COPILOT_API_VERSION),
    },
  )

  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => '')
    throw new Error(`GitHub Copilot coding agent enable failed: ${res.status} ${text}`)
  }

  return 'enabled_for_selected_repositories'
}

/**
 * Set a repository secret via the GitHub Secrets API.
 * Idempotent: overwrites if the secret already exists.
 *
 * Requires libsodium-wrappers for NaCl sealed-box encryption.
 * Compatible with Cloudflare Workers (nodejs_compat flag).
 */
export async function setRepoSecret(
  ghToken: string,
  repo: string,
  secretName: string,
  secretValue: string,
): Promise<void> {
  // 1. Get the repo's public key for encryption
  const keyRes = await fetch(`${GH_API_BASE}/repos/${repo}/actions/secrets/public-key`, {
    headers: ghHeaders(ghToken),
  })

  if (!keyRes.ok) {
    const text = await keyRes.text().catch(() => '')
    throw new Error(`GitHub public key fetch failed: ${keyRes.status} ${text}`)
  }

  const { key, key_id } = (await keyRes.json()) as { key: string; key_id: string }

  // 2. Encrypt the secret using libsodium sealed box
  const sodiumModule = await import('libsodium-wrappers')
  // On Workers, ESM dynamic import wraps the module — access .default if needed
  const sodium = sodiumModule.default ?? sodiumModule
  await sodium.ready

  const binKey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL)
  const binSecret = sodium.from_string(secretValue)
  const encrypted = sodium.crypto_box_seal(binSecret, binKey)
  const encryptedBase64 = sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL)

  // 3. Set the secret
  const setRes = await fetch(`${GH_API_BASE}/repos/${repo}/actions/secrets/${secretName}`, {
    method: 'PUT',
    headers: ghHeaders(ghToken),
    body: JSON.stringify({
      encrypted_value: encryptedBase64,
      key_id,
    }),
  })

  if (!setRes.ok && setRes.status !== 204) {
    const text = await setRes.text().catch(() => '')
    throw new Error(`GitHub secret set failed: ${setRes.status} ${text}`)
  }
}

/**
 * Trigger a GitHub Actions workflow via workflow_dispatch.
 * Not idempotent by nature, but safe to call — each dispatch creates a new run.
 */
export async function triggerWorkflow(
  ghToken: string,
  repo: string,
  workflowFile: string,
  inputs: Record<string, string>,
  ref = 'main',
): Promise<void> {
  const res = await fetch(
    `${GH_API_BASE}/repos/${repo}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: 'POST',
      headers: ghHeaders(ghToken),
      body: JSON.stringify({ ref, inputs }),
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GitHub workflow dispatch failed: ${res.status} ${text}`)
  }
}

/**
 * Fetch a specific GitHub Actions workflow run by numeric run ID.
 */
export async function getWorkflowRun(
  ghToken: string,
  repo: string,
  runId: string,
): Promise<GithubWorkflowRun> {
  const res = await fetch(`${GH_API_BASE}/repos/${repo}/actions/runs/${runId}`, {
    headers: ghHeaders(ghToken),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GitHub workflow run fetch failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as {
    id: number
    html_url: string
    status: string
    conclusion: string | null
  }

  return {
    id: data.id,
    htmlUrl: data.html_url,
    status: data.status,
    conclusion: data.conclusion,
  }
}

/**
 * Create or update a file in a GitHub repository via the Contents API.
 * Idempotent: fetches the current SHA first to handle updates vs creates.
 */
export async function upsertFileContents(
  ghToken: string,
  repo: string,
  filePath: string,
  content: string,
  commitMessage: string,
): Promise<void> {
  // Check if file exists to get current SHA (needed for updates)
  let sha: string | undefined
  const getRes = await fetch(`${GH_API_BASE}/repos/${repo}/contents/${filePath}`, {
    headers: ghHeaders(ghToken),
  })

  if (getRes.ok) {
    const data = (await getRes.json()) as { sha?: string }
    sha = data.sha
  }

  // Base64 encode the content
  const contentBase64 = btoa(unescape(encodeURIComponent(content)))

  const body: Record<string, string> = {
    message: commitMessage,
    content: contentBase64,
  }
  if (sha) {
    body.sha = sha
  }

  const putRes = await fetch(`${GH_API_BASE}/repos/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers: ghHeaders(ghToken),
    body: JSON.stringify(body),
  })

  if (!putRes.ok) {
    const text = await putRes.text().catch(() => '')
    throw new Error(`GitHub file upsert failed for ${filePath}: ${putRes.status} ${text}`)
  }
}
