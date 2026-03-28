export type FleetDatabaseBackend = 'd1' | 'postgres'

function readStringSecret(secrets: Record<string, string>, key: string): string | undefined {
  const raw = secrets[key]
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }

  return trimmed
}

export function normalizeFleetDatabaseBackend(value?: string | null): FleetDatabaseBackend | null {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'postgres') return 'postgres'
  if (normalized === 'd1') return 'd1'
  return null
}

export function resolveFleetDatabaseBackendFromSources(
  storedBackend?: string | null,
  dopplerSecrets: Record<string, string> = {},
): FleetDatabaseBackend {
  return (
    normalizeFleetDatabaseBackend(storedBackend) ||
    normalizeFleetDatabaseBackend(readStringSecret(dopplerSecrets, 'NUXT_DATABASE_BACKEND')) ||
    'd1'
  )
}
