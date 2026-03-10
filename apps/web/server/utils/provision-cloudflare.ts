/**
 * Cloudflare D1 Database provisioning via REST API.
 * All operations are idempotent — safe to call multiple times.
 */

interface D1Database {
  uuid: string
  name: string
  created_at?: string
}

interface CloudflareApiResponse<T> {
  success: boolean
  result: T
  errors: Array<{ code: number; message: string }>
}

const CF_API_BASE = 'https://api.cloudflare.com/client/v4'

function cfHeaders(apiToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  }
}

/**
 * List all D1 databases and find one by name.
 * Returns the database if found, null otherwise.
 */
export async function getD1DatabaseByName(
  accountId: string,
  apiToken: string,
  dbName: string,
): Promise<D1Database | null> {
  const res = await fetch(
    `${CF_API_BASE}/accounts/${accountId}/d1/database?name=${encodeURIComponent(dbName)}`,
    { headers: cfHeaders(apiToken) },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Cloudflare D1 list failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as CloudflareApiResponse<D1Database[]>
  if (!data.success) {
    throw new Error(`Cloudflare D1 list error: ${data.errors.map((e) => e.message).join(', ')}`)
  }

  return data.result.find((db) => db.name === dbName) ?? null
}

/**
 * Create a D1 database. Idempotent: returns existing DB if name already exists.
 */
export async function createD1Database(
  accountId: string,
  apiToken: string,
  dbName: string,
): Promise<D1Database> {
  // Check if already exists
  const existing = await getD1DatabaseByName(accountId, apiToken, dbName)
  if (existing) {
    return existing
  }

  // Create new
  const res = await fetch(`${CF_API_BASE}/accounts/${accountId}/d1/database`, {
    method: 'POST',
    headers: cfHeaders(apiToken),
    body: JSON.stringify({ name: dbName }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    // Handle race condition where DB was created between check and create
    if (res.status === 409 || text.includes('already exists')) {
      const found = await getD1DatabaseByName(accountId, apiToken, dbName)
      if (found) return found
    }
    throw new Error(`Cloudflare D1 create failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as CloudflareApiResponse<D1Database>
  if (!data.success) {
    throw new Error(`Cloudflare D1 create error: ${data.errors.map((e) => e.message).join(', ')}`)
  }

  return data.result
}
