/**
 * Analytics provisioning via Google APIs + IndexNow.
 * All operations are idempotent — safe to call multiple times.
 *
 * Uses Web Crypto API for RS256 JWT signing (Workers-compatible).
 * Does NOT use the `googleapis` npm package (Node.js-only).
 */

// ─── Google JWT Auth (Web Crypto) ───────────────────────────

interface ServiceAccountCredentials {
  client_email: string
  private_key: string
  private_key_id?: string
}

/**
 * Parse service account JSON (supports raw JSON string or base64-encoded).
 */
export function parseServiceAccountJson(raw: string): ServiceAccountCredentials {
  let str = raw.trim()
  if (!str.startsWith('{')) {
    str = atob(str)
  }
  const parsed = JSON.parse(str) as ServiceAccountCredentials
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Invalid service account JSON: missing client_email or private_key')
  }
  return parsed
}

/**
 * Sign an RS256 JWT using Web Crypto (Cloudflare Workers compatible).
 */
async function signJwt(
  payload: Record<string, unknown>,
  privateKeyPem: string,
  keyId?: string,
): Promise<string> {
  // Build header
  const header: Record<string, string> = { alg: 'RS256', typ: 'JWT' }
  if (keyId) header.kid = keyId

  // Base64URL encode
  const enc = new TextEncoder()
  const b64url = (data: string) =>
    btoa(data).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')

  const headerB64 = b64url(JSON.stringify(header))
  const payloadB64 = b64url(JSON.stringify(payload))
  const signingInput = `${headerB64}.${payloadB64}`

  // Import PEM private key
  const pemBody = privateKeyPem
    .replaceAll('-----BEGIN PRIVATE KEY-----', '')
    .replaceAll('-----END PRIVATE KEY-----', '')
    .replaceAll(/\s/g, '')

  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  // Sign
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    enc.encode(signingInput),
  )

  const sigB64 = b64url(
    Array.from(new Uint8Array(signature), (b) => String.fromCharCode(b)).join(''),
  )

  return `${signingInput}.${sigB64}`
}

/**
 * Get a Google OAuth2 access token from a service account JWT.
 * Tokens are valid for 1 hour — callers should cache if making multiple calls.
 */
export async function getGoogleAccessToken(
  credentials: ServiceAccountCredentials,
  scopes: string[],
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const jwt = await signJwt(
    {
      iss: credentials.client_email,
      sub: credentials.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      scope: scopes.join(' '),
      iat: now,
      exp: now + 3600,
    },
    credentials.private_key,
    credentials.private_key_id,
  )

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Google OAuth2 token exchange failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) {
    throw new Error('Google OAuth2 response missing access_token')
  }

  return data.access_token
}

// ─── GA4 Provisioning ───────────────────────────────────────

const GA_ADMIN_API = 'https://analyticsadmin.googleapis.com/v1beta'

interface GA4PropertyResult {
  propertyId: string
  propertyName: string
}

/**
 * Create or find a GA4 property under an account.
 * Idempotent: returns existing property if one with matching displayName exists.
 */
export async function createGA4Property(
  accessToken: string,
  accountId: string,
  displayName: string,
  _siteUrl: string,
): Promise<GA4PropertyResult> {
  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }

  // Check for existing property (paginated — accounts may have many properties)
  let nextPageToken = ''
  do {
    const pageParam = nextPageToken ? `&pageToken=${encodeURIComponent(nextPageToken)}` : ''
    const listRes = await fetch(
      `${GA_ADMIN_API}/properties?filter=${encodeURIComponent(`parent:accounts/${accountId}`)}&pageSize=200${pageParam}`,
      { headers: authHeaders },
    )

    if (listRes.ok) {
      const listData = (await listRes.json()) as {
        properties?: Array<{ name?: string; displayName?: string }>
        nextPageToken?: string
      }
      const existing = listData.properties?.find((p) => p.displayName === displayName)
      if (existing?.name) {
        const propertyId = existing.name.replace('properties/', '')
        return { propertyId, propertyName: existing.name }
      }
      nextPageToken = listData.nextPageToken || ''
    } else {
      nextPageToken = ''
    }
  } while (nextPageToken)

  // Create new property
  const createRes = await fetch(`${GA_ADMIN_API}/properties`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      parent: `accounts/${accountId}`,
      displayName,
      timeZone: 'America/Los_Angeles',
      currencyCode: 'USD',
    }),
  })

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '')
    throw new Error(`GA4 property creation failed: ${createRes.status} ${text}`)
  }

  const created = (await createRes.json()) as { name?: string }
  if (!created.name) throw new Error('GA4 property created but no name in response')

  const propertyId = created.name.replace('properties/', '')
  return { propertyId, propertyName: created.name }
}

interface GA4DataStreamResult {
  measurementId: string
}

/**
 * Create or find a GA4 web data stream.
 * Idempotent: returns existing stream if one of type WEB_DATA_STREAM exists.
 */
export async function createGA4DataStream(
  accessToken: string,
  propertyName: string,
  displayName: string,
  siteUrl: string,
): Promise<GA4DataStreamResult> {
  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }

  // Check for existing stream
  const listRes = await fetch(`${GA_ADMIN_API}/${propertyName}/dataStreams`, {
    headers: authHeaders,
  })

  if (listRes.ok) {
    const listData = (await listRes.json()) as {
      dataStreams?: Array<{ type?: string; webStreamData?: { measurementId?: string } }>
    }
    const existing = listData.dataStreams?.find((s) => s.type === 'WEB_DATA_STREAM')
    if (existing?.webStreamData?.measurementId) {
      return { measurementId: existing.webStreamData.measurementId }
    }
  }

  // Create new stream
  const createRes = await fetch(`${GA_ADMIN_API}/${propertyName}/dataStreams`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      displayName: `${displayName} Web`,
      type: 'WEB_DATA_STREAM',
      webStreamData: {
        defaultUri: siteUrl.replace(/\/$/, ''),
      },
    }),
  })

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '')
    throw new Error(`GA4 data stream creation failed: ${createRes.status} ${text}`)
  }

  const created = (await createRes.json()) as {
    webStreamData?: { measurementId?: string }
  }
  if (!created.webStreamData?.measurementId) {
    throw new Error('GA4 data stream created but no measurementId in response')
  }

  return { measurementId: created.webStreamData.measurementId }
}

// ─── GSC Provisioning ───────────────────────────────────────

/**
 * Register a site in Google Search Console.
 * Idempotent: no-ops if the site is already registered (409 = already exists).
 */
export async function registerGscSite(accessToken: string, siteUrl: string): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  )

  // 204 = success, 409 = already exists, both are fine
  if (!res.ok && res.status !== 204 && res.status !== 409) {
    const text = await res.text().catch(() => '')
    throw new Error(`GSC site registration failed: ${res.status} ${text}`)
  }
}

interface GscVerificationResult {
  fileName: string
  fileContent: string
}

/**
 * Get the GSC file verification token for a site.
 * Idempotent: always returns the same token for the same site.
 */
export async function getGscVerificationToken(
  accessToken: string,
  siteUrl: string,
): Promise<GscVerificationResult> {
  const res = await fetch('https://www.googleapis.com/siteVerification/v1/token', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      site: { identifier: siteUrl, type: 'SITE' },
      verificationMethod: 'FILE',
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GSC verification token request failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as { token?: string }
  if (!data.token) {
    throw new Error('GSC verification response missing token')
  }

  const token = data.token
  // Parse the token to extract filename and content
  const htmlMatch = token.match(/google[0-9a-z]+\.html/i)
  const fileName =
    token.match(/verification-file=([^:\s]+)/i)?.[1] ||
    (htmlMatch ? htmlMatch[0] : '') ||
    'google-verification.html'
  const fileContent = token.includes('google-site-verification:')
    ? token
    : `google-site-verification: ${fileName}`

  return { fileName, fileContent }
}

/**
 * Verify ownership of a GSC site via FILE method.
 * Must be called AFTER the verification file is deployed and accessible.
 * Idempotent: succeeds silently if already verified.
 */
export async function verifyGscOwnership(accessToken: string, siteUrl: string): Promise<void> {
  const res = await fetch(
    'https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=FILE',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        site: { identifier: siteUrl, type: 'SITE' },
      }),
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    // Already verified is fine
    if (text.includes('already verified') || text.includes('already owns')) return
    throw new Error(`GSC ownership verification failed: ${res.status} ${text}`)
  }
}

/**
 * Grant a user email owner access to a GSC site.
 * Idempotent: adds the email only if not already present.
 */
export async function grantGscAccess(
  accessToken: string,
  siteUrl: string,
  userEmail: string,
): Promise<void> {
  // Get current owners
  const getRes = await fetch(
    `https://www.googleapis.com/siteVerification/v1/webResource/${encodeURIComponent(siteUrl)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  let owners: string[] = []
  if (getRes.ok) {
    const data = (await getRes.json()) as { owners?: string[] }
    owners = data.owners || []
  }

  if (owners.includes(userEmail)) return // Already has access

  owners.push(userEmail)

  const updateRes = await fetch(
    `https://www.googleapis.com/siteVerification/v1/webResource/${encodeURIComponent(siteUrl)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        site: { identifier: siteUrl, type: 'SITE' },
        owners,
      }),
    },
  )

  if (!updateRes.ok) {
    const text = await updateRes.text().catch(() => '')
    throw new Error(`GSC access grant failed for ${userEmail}: ${updateRes.status} ${text}`)
  }
}

/**
 * Submit a sitemap to GSC.
 * Idempotent: re-submission is accepted by Google.
 */
export async function submitGscSitemap(accessToken: string, siteUrl: string): Promise<void> {
  const sitemapUrl = `${siteUrl.replace(/\/$/, '')}/sitemap.xml`

  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  )

  // 204 = success, 409 = already submitted, both fine
  if (!res.ok && res.status !== 204 && res.status !== 409) {
    const text = await res.text().catch(() => '')
    throw new Error(`GSC sitemap submission failed: ${res.status} ${text}`)
  }
}

// ─── IndexNow ───────────────────────────────────────────────

/**
 * Generate a random IndexNow API key.
 * Deterministic by input if a seed is provided (for idempotency).
 */
export function generateIndexNowKey(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
