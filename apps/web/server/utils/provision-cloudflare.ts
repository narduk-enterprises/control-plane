/**
 * Cloudflare D1 Database provisioning via REST API.
 * All operations are idempotent — safe to call multiple times.
 */

export interface D1Database {
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
 * List every D1 database in the account (paginated).
 */
export async function listAllD1Databases(
  accountId: string,
  apiToken: string,
): Promise<D1Database[]> {
  const all: D1Database[] = []
  let page = 1
  const perPage = 100
  const maxPages = 500

  while (page <= maxPages) {
    const res = await fetch(
      `${CF_API_BASE}/accounts/${accountId}/d1/database?page=${page}&per_page=${perPage}`,
      { headers: cfHeaders(apiToken) },
    )

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Cloudflare D1 list failed: ${res.status} ${text}`)
    }

    const data = (await res.json()) as CloudflareApiResponse<D1Database[]> & {
      result_info?: { total_count?: number }
    }
    if (!data.success) {
      throw new Error(`Cloudflare D1 list error: ${data.errors.map((e) => e.message).join(', ')}`)
    }

    const batch = data.result ?? []
    all.push(...batch)

    const total = data.result_info?.total_count
    if (batch.length === 0) break
    if (total !== undefined && all.length >= total) break
    if (batch.length < perPage) break
    page += 1
  }

  return all
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

/** One statement result from POST /d1/database/:id/query (batch item). */
export interface D1RemoteQueryStatementResult {
  success?: boolean
  /** Object rows and/or Cloudflare `{ columns, rows }` shape. */
  results?:
    | Record<string, unknown>[]
    | { columns?: string[]; rows?: unknown[][] }
  meta?: Record<string, unknown>
}

/**
 * Run SQL against a D1 database via the Cloudflare API (remote).
 * Supports multiple statements separated by semicolons (executed as a batch).
 */
export async function queryD1Database(
  accountId: string,
  apiToken: string,
  databaseId: string,
  sql: string,
  params?: string[],
): Promise<D1RemoteQueryStatementResult[]> {
  const payload: { sql: string; params?: string[] } = { sql }
  if (params && params.length > 0) {
    payload.params = params
  }

  const res = await fetch(
    `${CF_API_BASE}/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: cfHeaders(apiToken),
      body: JSON.stringify(payload),
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Cloudflare D1 query failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as {
    success: boolean
    errors?: Array<{ message: string }>
    result?: D1RemoteQueryStatementResult[]
  }

  if (!data.success) {
    throw new Error(
      `Cloudflare D1 query error: ${data.errors?.map((e) => e.message).join(', ') || 'unknown'}`,
    )
  }

  const raw = data.result
  if (raw === undefined || raw === null) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if ('results' in o || 'success' in o || 'meta' in o) {
      return [raw as D1RemoteQueryStatementResult]
    }
  }
  return []
}
