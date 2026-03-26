import type { FleetDatabaseBackend } from '~/types/fleet'

const SAFE = /^[_a-z]\w*$/i

function assertIdent(name: string) {
  if (!SAFE.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`)
  }
}

export function quoteSqlIdent(name: string): string {
  assertIdent(name)
  return `"${name.replaceAll('"', '""')}"`
}

export function quoteTableRef(
  backend: FleetDatabaseBackend,
  value: string,
  fallbackSchema = 'public',
): string {
  const trimmed = value.trim()
  if (backend === 'd1') {
    return quoteSqlIdent(trimmed)
  }

  const parts = trimmed.split('.').filter(Boolean)
  if (parts.length === 1) {
    return `${quoteSqlIdent(fallbackSchema)}.${quoteSqlIdent(parts[0] || '')}`
  }
  if (parts.length === 2) {
    return `${quoteSqlIdent(parts[0] || '')}.${quoteSqlIdent(parts[1] || '')}`
  }

  throw new Error(`Invalid table reference: ${value}`)
}

export function sqlPlaceholder(backend: FleetDatabaseBackend, position: number): string {
  return backend === 'postgres' ? `$${position}` : '?'
}
