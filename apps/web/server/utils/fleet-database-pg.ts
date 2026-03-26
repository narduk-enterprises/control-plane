import postgres from 'postgres'
import type { FleetDatabaseStatementResult } from '~/types/fleet'
import { splitSqlStatements } from '#server/utils/split-sql-statements'

type PgQueryParam = string | number | boolean | null

function normalizePgValue(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64')
  return value
}

function normalizePgRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizePgValue(value)]))
}

function buildPgMeta(result: Record<string, unknown>): Record<string, unknown> {
  const meta: Record<string, unknown> = {}

  if (typeof result.command === 'string' && result.command) {
    meta.command = result.command
  }
  if (typeof result.count === 'number') {
    meta.count = result.count
  }
  if (Array.isArray(result.columns)) {
    meta.columns = result.columns
      .map((column) => {
        if (column && typeof column === 'object' && 'name' in column) {
          return String((column as { name: unknown }).name)
        }
        return null
      })
      .filter((column): column is string => Boolean(column))
  }

  return meta
}

function parseDatabaseName(connectionString: string): string {
  try {
    const url = new URL(connectionString)
    const name = url.pathname.replace(/^\/+/, '').trim()
    if (name) return decodeURIComponent(name)
  } catch {
    // Fall through to default.
  }

  return 'postgres'
}

async function withPgClient<T>(
  connectionString: string,
  handler: (sql: ReturnType<typeof postgres>) => Promise<T>,
): Promise<T> {
  const sql = postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 15,
  })

  try {
    return await handler(sql)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

function assertSingleStatement(sql: string): string {
  const statements = splitSqlStatements(sql)
  if (statements.length !== 1) {
    throw new Error('Parameterized Postgres queries must contain exactly one SQL statement.')
  }
  return statements[0] || ''
}

export async function executeSqlOnFleetAppPostgres(options: {
  connectionString: string
  sql: string
  params?: PgQueryParam[]
}): Promise<{
  databaseName: string
  result: FleetDatabaseStatementResult[]
}> {
  const { connectionString, params } = options
  const databaseName = parseDatabaseName(connectionString)

  const result = await withPgClient(connectionString, async (sql) => {
    if (params && params.length > 0) {
      const statement = assertSingleStatement(options.sql)
      const rows = await sql.unsafe<Record<string, unknown>[]>(statement, params)
      return [
        {
          success: true,
          results: rows.map(normalizePgRow),
          meta: buildPgMeta(rows as unknown as Record<string, unknown>),
        },
      ] satisfies FleetDatabaseStatementResult[]
    }

    const statements = splitSqlStatements(options.sql)
    if (statements.length === 0) return []

    const batches: FleetDatabaseStatementResult[] = []
    for (let index = 0; index < statements.length; index += 1) {
      const statement = statements[index]
      if (!statement) continue
      try {
        const rows = await sql.unsafe<Record<string, unknown>[]>(statement).simple()
        batches.push({
          success: true,
          results: rows.map(normalizePgRow),
          meta: buildPgMeta(rows as unknown as Record<string, unknown>),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`Statement ${index + 1} failed: ${message}`)
      }
    }

    return batches
  })

  return { databaseName, result }
}

export async function queryFleetPostgresRows(options: {
  connectionString: string
  sql: string
  params?: PgQueryParam[]
}): Promise<Record<string, unknown>[]> {
  return withPgClient(options.connectionString, async (client) => {
    const rows = options.params?.length
      ? await client.unsafe<Record<string, unknown>[]>(options.sql, options.params)
      : await client.unsafe<Record<string, unknown>[]>(options.sql)
    return rows.map(normalizePgRow)
  })
}

export async function queryFleetPostgresScalar(
  connectionString: string,
  sql: string,
  params?: PgQueryParam[],
): Promise<number> {
  const rows = await queryFleetPostgresRows({ connectionString, sql, params })
  const firstRow = rows[0]
  if (!firstRow) return 0

  const firstValue = Object.values(firstRow)[0]
  if (typeof firstValue === 'number' && Number.isFinite(firstValue)) return firstValue
  if (typeof firstValue === 'string' && firstValue.trim()) {
    const parsed = Number(firstValue)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}
