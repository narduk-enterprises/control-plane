/**
 * Fleet registry row as stored in the `fleet_apps` D1 table.
 */
export interface FleetRegistryApp {
  name: string
  url: string
  dopplerProject: string
  nuxtPort?: number | null
  gaPropertyId?: string | null
  gaMeasurementId?: string | null
  posthogAppName?: string | null
  githubRepo?: string | null
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

/**
 * Fleet app status as stored in the `app_status` D1 table.
 * Shared between server endpoints and client components.
 */
export interface FleetAppStatusRecord {
  app: string
  url: string
  status: 'up' | 'down'
  statusCode: number | null
  checkedAt: string
  indexnowLastSubmission: string | null
  indexnowTotalSubmissions: number
  indexnowLastSubmittedCount: number | null
}

/** One batch item from Cloudflare D1 HTTP API (remote query). */
export interface FleetD1StatementResult {
  success?: boolean
  results?: Record<string, unknown>[]
  meta?: Record<string, unknown>
}

/** Successful POST /api/fleet/apps/:name/d1/query response body. */
export interface FleetD1QueryResponse {
  ok: true
  app: string
  databaseId: string
  databaseName: string
  result: FleetD1StatementResult[]
}

/** PRAGMA table_info row (studio). */
export interface FleetD1ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: unknown
  pk: number
}

export interface FleetD1TablesResponse {
  ok: true
  app: string
  databaseId: string
  databaseName: string
  tables: string[]
  /** Rows in sqlite_master (table/view) before hiding system/CF-internal names. */
  catalogTableCount: number
  /** Hidden names (sqlite_*, _cf_*). Non-zero means the DB is not empty, only filtered. */
  internalTableCount: number
  /** Present when `tables` is empty but the catalog has objects worth explaining. */
  hint?: string
}

export interface FleetD1TableGridResponse {
  ok: true
  app: string
  databaseId: string
  databaseName: string
  table: string
  columns: FleetD1ColumnInfo[]
  rows: Record<string, unknown>[]
  total: number
  limit: number
  offset: number
}
