import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { fleetApps } from '#server/database/schema'
import { getDopplerSecrets } from '#server/utils/provision-doppler'

export type FleetDatabaseBackend = 'd1' | 'postgres'

export interface FleetDatabaseAppRecord {
  name: string
  url: string
  dopplerProject: string
  databaseBackend: FleetDatabaseBackend
  d1DatabaseName: string | null
}

export interface FleetD1Target {
  backend: 'd1'
  app: FleetDatabaseAppRecord
  accountId: string
  apiToken: string
}

export interface FleetPostgresTarget {
  backend: 'postgres'
  app: FleetDatabaseAppRecord
  connectionString: string
  connectionStringSource: string
  controlPlaneApiKey: string | null
  schemaName: string
}

export type FleetDatabaseTarget = FleetD1Target | FleetPostgresTarget

const SAFE_SCHEMA_IDENT = /^[_a-z]\w*$/i
const POSTGRES_CONNECTION_SECRET_KEYS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_CONNECTION_STRING',
  'NEON_DATABASE_URL',
  'NEON_CONNECTION_STRING',
  'PGDATABASE_URL',
] as const

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

function assertSchemaName(name: string): string {
  const trimmed = name.trim()
  if (!SAFE_SCHEMA_IDENT.test(trimmed)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid schema name (use letters, numbers, underscore only).',
    })
  }
  return trimmed
}

function isPostgresConnectionString(value: string): boolean {
  return /^postgres(?:ql)?:\/\//i.test(value)
}

function normalizeDatabaseBackend(value?: string | null): FleetDatabaseBackend | null {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'postgres') return 'postgres'
  if (normalized === 'd1') return 'd1'
  return null
}

function resolveControlPlaneApiKey(secrets: Record<string, string>): string | null {
  for (const key of ['CONTROL_PLANE_API_KEY', 'FLEET_API_KEY']) {
    const value = readStringSecret(secrets, key)
    if (value) return value
  }

  return null
}

function resolvePostgresConnection(
  secrets: Record<string, string>,
): { connectionString: string; source: string } | null {
  const bindingName = readStringSecret(secrets, 'NUXT_HYPERDRIVE_BINDING') || 'HYPERDRIVE'
  const dynamicCandidates = [
    `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_${bindingName}`,
    'CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING',
  ]

  for (const key of [...POSTGRES_CONNECTION_SECRET_KEYS, ...dynamicCandidates]) {
    const value = readStringSecret(secrets, key)
    if (value && isPostgresConnectionString(value)) {
      return { connectionString: value, source: key }
    }
  }

  return null
}

async function getFleetAppRecord(event: H3Event, appName: string): Promise<FleetDatabaseAppRecord> {
  const db = useDatabase(event)
  const existing = await db
    .select({
      name: fleetApps.name,
      url: fleetApps.url,
      dopplerProject: fleetApps.dopplerProject,
      databaseBackend: fleetApps.databaseBackend,
      d1DatabaseName: fleetApps.d1DatabaseName,
    })
    .from(fleetApps)
    .where(eq(fleetApps.name, appName))
    .limit(1)
    .all()

  const app = existing[0]
  if (!app) {
    throw createError({ statusCode: 404, message: `App '${appName}' not found in fleet registry.` })
  }

  return {
    ...app,
    databaseBackend: normalizeDatabaseBackend(app.databaseBackend) ?? 'd1',
  }
}

export async function resolveFleetDatabaseTarget(
  event: H3Event,
  appName: string,
  options: { schemaName?: string } = {},
): Promise<FleetDatabaseTarget> {
  const app = await getFleetAppRecord(event, appName)
  const config = useRuntimeConfig(event)

  const dopplerToken = String(config.dopplerApiToken || '').trim()
  let dopplerSecrets: Record<string, string> = {}

  if (dopplerToken) {
    try {
      dopplerSecrets = await getDopplerSecrets(dopplerToken, app.dopplerProject, 'prd')
    } catch (error) {
      useLogger(event)
        .child('FleetDatabase')
        .warn('Failed to load Doppler secrets for backend detection', {
          app: appName,
          dopplerProject: app.dopplerProject,
          error: error instanceof Error ? error.message : String(error),
        })
    }
  }

  const backend =
    normalizeDatabaseBackend(app.databaseBackend) ||
    normalizeDatabaseBackend(readStringSecret(dopplerSecrets, 'NUXT_DATABASE_BACKEND')) ||
    'd1'

  if (backend === 'postgres') {
    const schemaName = assertSchemaName(options.schemaName?.trim() || 'public')
    const resolved = resolvePostgresConnection(dopplerSecrets)

    if (!resolved) {
      throw createError({
        statusCode: 503,
        message: `Postgres viewer needs a production connection string in Doppler (${app.dopplerProject}/prd). Set DATABASE_URL, POSTGRES_URL, or POSTGRES_CONNECTION_STRING.`,
      })
    }

    return {
      backend: 'postgres',
      app,
      connectionString: resolved.connectionString,
      connectionStringSource: resolved.source,
      controlPlaneApiKey: resolveControlPlaneApiKey(dopplerSecrets),
      schemaName,
    }
  }

  const accountId = String(config.cloudflareAccountId || '').trim()
  const apiToken = String(config.cloudflareApiToken || '').trim()
  if (!accountId || !apiToken) {
    throw createError({
      statusCode: 503,
      message:
        'Cloudflare credentials are not configured on the control plane (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN).',
    })
  }

  return {
    backend: 'd1',
    app,
    accountId,
    apiToken,
  }
}
