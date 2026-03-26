import type { D1RemoteQueryStatementResult } from './provision-cloudflare'

/** SQLite identifiers we allow in studio (no quotes/quotes injection). */
const SAFE_SQL_IDENT = /^[_a-z]\w*$/i

export function assertFleetD1TableName(name: string): void {
  if (!name || !SAFE_SQL_IDENT.test(name)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid table name (use letters, numbers, underscore only).',
    })
  }
}

export function quoteSqliteIdent(name: string): string {
  assertFleetD1TableName(name)
  return `"${name.replaceAll('"', '""')}"`
}

/**
 * Normalize one D1 HTTP statement: rows as objects, supporting `{ columns, rows }` payloads.
 */
export function normalizeD1StatementRows(
  batch: D1RemoteQueryStatementResult | undefined,
): Record<string, unknown>[] {
  if (!batch) return []
  const raw = batch.results
  if (raw === undefined || raw === null) return []

  if (Array.isArray(raw)) {
    if (raw.length === 0) return []
    const first = raw[0]
    if (typeof first === 'object' && first !== null && !Array.isArray(first)) {
      return raw as Record<string, unknown>[]
    }
    return []
  }

  if (typeof raw === 'object' && 'columns' in raw && 'rows' in raw) {
    const cols = (raw as { columns?: string[] }).columns ?? []
    const dataRows = (raw as { rows?: unknown[][] }).rows ?? []
    return dataRows.map((cells) => {
      const o: Record<string, unknown> = {}
      for (let i = 0; i < cols.length; i++) {
        const key = cols[i]
        if (key === undefined) continue
        o[key] = cells[i]
      }
      return o
    })
  }

  return []
}

export function assertFirstStatementOk(
  batches: D1RemoteQueryStatementResult[],
  context: string,
): void {
  const b = batches[0]
  if (b?.success === false) {
    const meta = b.meta as { error?: string } | undefined
    const msg =
      meta?.error ||
      (typeof b.meta === 'object' && b.meta && 'message' in b.meta
        ? String((b.meta as { message?: string }).message)
        : '') ||
      'Statement failed'
    throw new Error(`${context}: ${msg}`)
  }
}

export function firstStatementRows(
  batches: D1RemoteQueryStatementResult[],
): Record<string, unknown>[] {
  return normalizeD1StatementRows(batches[0])
}

/** Case-insensitive column read (D1 JSON keys vary). */
export function getRowValue(row: Record<string, unknown>, key: string): unknown {
  const lower = key.toLowerCase()
  const k = Object.keys(row).find((x) => x.toLowerCase() === lower)
  return k ? row[k] : undefined
}

export function pickSqliteMasterTableName(row: Record<string, unknown>): string | null {
  for (const [k, v] of Object.entries(row)) {
    const kl = k.toLowerCase()
    if ((kl === 'name' || kl === 'tbl_name') && typeof v === 'string' && v.trim()) {
      return v.trim()
    }
  }
  return null
}

export function firstStatementScalar(batches: D1RemoteQueryStatementResult[], key: string): number {
  const rows = firstStatementRows(batches)
  const row = rows[0]
  if (!row) return 0
  const lowerKey = key.toLowerCase()
  let v: unknown = row[key]
  if (v === undefined) {
    const match = Object.keys(row).find((k) => k.toLowerCase() === lowerKey)
    if (match) v = row[match]
  }
  if (typeof v === 'bigint') return Number(v)
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return 0
}

/**
 * List schema objects from sqlite_master.
 *
 * Important: do NOT use SQL `LIKE 'sqlite_%'` here — in SQLite `_` is a wildcard, so patterns
 * can exclude legitimate names. Filter system/CF internals in application code instead.
 */
export const LIST_USER_TABLES_SQL = `
SELECT DISTINCT name AS name
FROM sqlite_master
WHERE lower(type) IN ('table', 'view')
ORDER BY name
`.trim()

/** Tables to hide in the studio sidebar (system + Cloudflare D1 internals). */
export function shouldListFleetTable(name: string): boolean {
  const n = name.trim()
  if (!n) return false
  const lower = n.toLowerCase()
  if (lower.startsWith('sqlite_')) return false
  if (lower.startsWith('_cf_')) return false
  return true
}
