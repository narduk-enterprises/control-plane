import type { FleetDatabaseBackend, FleetDatabaseColumnInfo } from '~/types/fleet'

const SAFE_SQL_IDENT = /^[_a-z]\w*$/i

export function assertFleetSqlIdent(name: string): void {
  if (!name || !SAFE_SQL_IDENT.test(name)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid SQL identifier (use letters, numbers, underscore only).',
    })
  }
}

export function quoteSqlIdent(name: string): string {
  assertFleetSqlIdent(name)
  return `"${name.replaceAll('"', '""')}"`
}

export function parseFleetTableRef(
  backend: FleetDatabaseBackend,
  value: string,
  fallbackSchema = 'public',
): { schema: string; table: string; displayName: string } {
  const trimmed = value.trim()
  if (!trimmed) {
    throw createError({ statusCode: 400, statusMessage: 'Missing table name.' })
  }

  if (backend === 'd1') {
    assertFleetSqlIdent(trimmed)
    return { schema: fallbackSchema, table: trimmed, displayName: trimmed }
  }

  const parts = trimmed.split('.').filter(Boolean)
  if (parts.length === 1) {
    assertFleetSqlIdent(fallbackSchema)
    assertFleetSqlIdent(parts[0] || '')
    return {
      schema: fallbackSchema,
      table: parts[0] || '',
      displayName: `${fallbackSchema}.${parts[0] || ''}`,
    }
  }

  if (parts.length === 2) {
    assertFleetSqlIdent(parts[0] || '')
    assertFleetSqlIdent(parts[1] || '')
    return {
      schema: parts[0] || '',
      table: parts[1] || '',
      displayName: `${parts[0] || ''}.${parts[1] || ''}`,
    }
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Invalid table name. Use "table" or "schema.table".',
  })
}

export function quoteQualifiedTableRef(
  backend: FleetDatabaseBackend,
  value: string,
  fallbackSchema = 'public',
): { schema: string; table: string; displayName: string; quoted: string } {
  const parsed = parseFleetTableRef(backend, value, fallbackSchema)
  return {
    ...parsed,
    quoted:
      backend === 'postgres'
        ? `${quoteSqlIdent(parsed.schema)}.${quoteSqlIdent(parsed.table)}`
        : quoteSqlIdent(parsed.table),
  }
}

function getColumnRowValue(row: Record<string, unknown>, key: string): unknown {
  const lower = key.toLowerCase()
  const match = Object.keys(row).find((candidate) => candidate.toLowerCase() === lower)
  return match ? row[match] : undefined
}

export function formatPostgresTableName(schema: string, table: string): string {
  assertFleetSqlIdent(schema)
  assertFleetSqlIdent(table)
  return `${schema}.${table}`
}

export function mapPostgresColumnRow(row: Record<string, unknown>): FleetDatabaseColumnInfo {
  return {
    cid: Number(getColumnRowValue(row, 'cid') ?? 0),
    name: String(getColumnRowValue(row, 'name') ?? ''),
    type: String(getColumnRowValue(row, 'type') ?? ''),
    notnull: Number(getColumnRowValue(row, 'notnull') ?? 0),
    dflt_value: getColumnRowValue(row, 'dflt_value') ?? null,
    pk: Number(getColumnRowValue(row, 'pk') ?? 0),
  }
}
