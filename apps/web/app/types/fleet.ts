export type FleetDatabaseBackend = 'd1' | 'postgres'

/**
 * Fleet registry row as stored in the `fleet_apps` D1 table.
 */
export interface FleetRegistryApp {
  name: string
  url: string
  dopplerProject: string
  databaseBackend?: FleetDatabaseBackend
  d1DatabaseName?: string | null
  nuxtPort?: number | null
  gaPropertyId?: string | null
  gaMeasurementId?: string | null
  posthogAppName?: string | null
  githubRepo?: string | null
  appDescription?: string | null
  isActive?: boolean
  authEnabled?: boolean
  redirectBaseUrl?: string | null
  loginPath?: string
  callbackPath?: string
  logoutPath?: string
  confirmPath?: string
  resetPath?: string
  publicSignup?: boolean
  providers?: Array<'apple' | 'email'>
  requireMfa?: boolean
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

/** One statement result from the fleet database viewer. */
export interface FleetDatabaseStatementResult {
  success?: boolean
  results?: Record<string, unknown>[]
  meta?: Record<string, unknown>
}

/** Successful POST /api/fleet/apps/:name/database/query response body. */
export interface FleetDatabaseQueryResponse {
  ok: true
  app: string
  backend: FleetDatabaseBackend
  databaseId: string | null
  databaseName: string
  schemaName: string | null
  result: FleetDatabaseStatementResult[]
}

/** Normalized column metadata for the fleet database viewer. */
export interface FleetDatabaseColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: unknown
  pk: number
}

export interface FleetDatabaseTablesResponse {
  ok: true
  app: string
  backend: FleetDatabaseBackend
  databaseId: string | null
  databaseName: string
  schemaName: string | null
  tables: string[]
  /** Rows in sqlite_master (table/view) before hiding system/CF-internal names. */
  catalogTableCount: number
  /** Hidden names (sqlite_*, _cf_*). Non-zero means the DB is not empty, only filtered. */
  internalTableCount: number
  /** Present when `tables` is empty but the catalog has objects worth explaining. */
  hint?: string
}

export interface FleetDatabaseTableGridResponse {
  ok: true
  app: string
  backend: FleetDatabaseBackend
  databaseId: string | null
  databaseName: string
  schemaName: string | null
  table: string
  columns: FleetDatabaseColumnInfo[]
  rows: Record<string, unknown>[]
  total: number
  limit: number
  offset: number
}

export type FleetD1StatementResult = FleetDatabaseStatementResult
export type FleetD1QueryResponse = FleetDatabaseQueryResponse
export type FleetD1ColumnInfo = FleetDatabaseColumnInfo
export type FleetD1TablesResponse = FleetDatabaseTablesResponse
export type FleetD1TableGridResponse = FleetDatabaseTableGridResponse
