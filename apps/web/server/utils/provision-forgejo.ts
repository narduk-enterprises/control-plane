const DEFAULT_FORGEJO_BASE_URL = 'https://code.nard.uk'
const DEFAULT_FORGEJO_OWNER = 'narduk-enterprises'

interface ForgejoUserResponse {
  login?: string
}

interface ForgejoRepoResponse {
  full_name?: string
  name?: string
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function buildHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/json',
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'narduk-control-plane',
  }
}

export function getForgejoBaseUrl(baseUrl?: string | null): string {
  return normalizeBaseUrl(baseUrl?.trim() || DEFAULT_FORGEJO_BASE_URL)
}

export function getForgejoOwner(owner?: string | null): string {
  return owner?.trim() || DEFAULT_FORGEJO_OWNER
}

export function buildForgejoRepoSlug(repoName: string, owner?: string | null): string {
  return `${getForgejoOwner(owner)}/${repoName.trim()}`
}

export function buildForgejoRepoUrl(
  repoName: string,
  options: { baseUrl?: string | null; owner?: string | null } = {},
): string {
  return `${getForgejoBaseUrl(options.baseUrl)}/${buildForgejoRepoSlug(repoName, options.owner)}`
}

export function buildForgejoBasicAuthHeader(username: string, token: string): string {
  return `Authorization: Basic ${btoa(`${username}:${token}`)}`
}

export async function getForgejoUsername(
  token: string,
  options: { baseUrl?: string | null; fetchImpl?: typeof fetch } = {},
): Promise<string> {
  const baseUrl = getForgejoBaseUrl(options.baseUrl)
  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(`${baseUrl}/api/v1/user`, {
    headers: buildHeaders(token),
  })

  if (!response.ok) {
    throw new Error(`Forgejo user lookup failed: ${response.status} ${await response.text()}`)
  }

  const payload = ((await response.json()) as ForgejoUserResponse).login?.trim()
  if (!payload) {
    throw new Error('Forgejo user lookup did not return a login name.')
  }

  return payload
}

export async function ensureForgejoRepo(
  token: string,
  repoName: string,
  options: {
    owner?: string | null
    baseUrl?: string | null
    description?: string | null
    private?: boolean
    fetchImpl?: typeof fetch
  } = {},
): Promise<'exists' | 'created'> {
  const owner = getForgejoOwner(options.owner)
  const baseUrl = getForgejoBaseUrl(options.baseUrl)
  const fetchImpl = options.fetchImpl ?? fetch

  const lookupResponse = await fetchImpl(`${baseUrl}/api/v1/repos/${owner}/${repoName}`, {
    headers: buildHeaders(token),
  })

  if (lookupResponse.ok) {
    return 'exists'
  }

  if (lookupResponse.status !== 404) {
    throw new Error(
      `Forgejo repo lookup failed for ${owner}/${repoName}: ${lookupResponse.status} ${await lookupResponse.text()}`,
    )
  }

  const createResponse = await fetchImpl(`${baseUrl}/api/v1/orgs/${owner}/repos`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify({
      auto_init: false,
      default_branch: 'main',
      description: options.description?.trim() || undefined,
      name: repoName,
      private: options.private ?? true,
    }),
  })

  if (!createResponse.ok) {
    throw new Error(
      `Forgejo repo create failed for ${owner}/${repoName}: ${createResponse.status} ${await createResponse.text()}`,
    )
  }

  const payload = (await createResponse.json()) as ForgejoRepoResponse
  if (!payload.full_name?.trim() && !payload.name?.trim()) {
    throw new Error(`Forgejo created ${owner}/${repoName} but returned an empty payload.`)
  }

  return 'created'
}

export async function deleteForgejoRepo(
  token: string,
  repoSlug: string,
  options: { baseUrl?: string | null; fetchImpl?: typeof fetch } = {},
): Promise<void> {
  const baseUrl = getForgejoBaseUrl(options.baseUrl)
  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(`${baseUrl}/api/v1/repos/${repoSlug}`, {
    method: 'DELETE',
    headers: buildHeaders(token),
  })

  if (!response.ok && response.status !== 404) {
    throw new Error(`Forgejo repo delete failed for ${repoSlug}: ${response.status}`)
  }
}
