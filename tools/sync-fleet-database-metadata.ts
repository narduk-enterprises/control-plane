/**
 * Sync fleet app database metadata into the control-plane registry.
 *
 * Resolution order:
 * 1. Local app repo config (`apps/web/drizzle.config.ts`, `apps/web/wrangler.json`)
 * 2. Doppler `NUXT_DATABASE_BACKEND` for checked-out gaps / legacy rows
 * 3. Existing registry values, then safe defaults
 *
 * Usage:
 *   doppler run --project control-plane --config prd -- npx tsx tools/sync-fleet-database-metadata.ts
 *   doppler run --project control-plane --config prd -- npx tsx tools/sync-fleet-database-metadata.ts --dry-run
 *   doppler run --project control-plane --config prd -- npx tsx tools/sync-fleet-database-metadata.ts --filter-apps=tx-spends,charts
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDopplerSecrets } from '../apps/web/server/utils/provision-doppler'

type FleetDatabaseBackend = 'd1' | 'postgres'

type FleetRegistryApp = {
  name: string
  dopplerProject: string
  databaseBackend?: FleetDatabaseBackend | null
  d1DatabaseName?: string | null
}

type FleetDatabaseMetadata = {
  databaseBackend: FleetDatabaseBackend
  d1DatabaseName: string | null
  source: string
}

const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || 'https://control-plane.nard.uk'
const dryRun = process.argv.includes('--dry-run')
const forceWrite = process.argv.includes('--force-write')
const toolsDir = dirname(fileURLToPath(import.meta.url))
const templateAppsRoot = resolve(toolsDir, '..')

function parseFilterAppsArg(): Set<string> | null {
  const raw = process.argv
    .find((arg) => arg.startsWith('--filter-apps='))
    ?.slice('--filter-apps='.length)
  if (!raw) return null

  const apps = raw
    .split(',')
    .map((app) => app.trim())
    .filter(Boolean)

  return apps.length > 0 ? new Set(apps) : null
}

function fleetApiHeaders(): Record<string, string> {
  const token = process.env.CONTROL_PLANE_API_KEY ?? process.env.FLEET_API_KEY ?? ''
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

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

function normalizeBackend(value?: string | null): FleetDatabaseBackend | null {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'postgres') return 'postgres'
  if (normalized === 'd1') return 'd1'
  return null
}

function readLocalDatabaseMetadata(appName: string): FleetDatabaseMetadata | null {
  const appDir = resolve(templateAppsRoot, appName)
  if (!existsSync(appDir)) return null

  const drizzleConfigPath = resolve(appDir, 'apps/web/drizzle.config.ts')
  const wranglerPath = resolve(appDir, 'apps/web/wrangler.json')

  let databaseBackend: FleetDatabaseBackend = 'd1'
  if (existsSync(drizzleConfigPath)) {
    const drizzleConfig = readFileSync(drizzleConfigPath, 'utf-8')
    if (/\bdialect:\s*['"]postgres(?:ql)?['"]/.test(drizzleConfig)) {
      databaseBackend = 'postgres'
    }
  }

  let d1DatabaseName: string | null = null
  if (databaseBackend === 'd1' && existsSync(wranglerPath)) {
    try {
      const wrangler = JSON.parse(readFileSync(wranglerPath, 'utf-8')) as {
        d1_databases?: Array<{ database_name?: string }>
      }
      d1DatabaseName = wrangler.d1_databases?.[0]?.database_name?.trim() || null
    } catch {
      d1DatabaseName = null
    }
  }

  return {
    databaseBackend,
    d1DatabaseName,
    source: 'local-repo',
  }
}

async function fetchFleetApps(): Promise<FleetRegistryApp[]> {
  const res = await fetch(`${CONTROL_PLANE_URL}/api/fleet/apps?includeInactive=true&force=true`, {
    headers: fleetApiHeaders(),
  })

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `${CONTROL_PLANE_URL}/api/fleet/apps rejected the request. Set CONTROL_PLANE_API_KEY (nk_... admin key).`,
    )
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Could not fetch fleet apps: HTTP ${res.status}${text ? ` ${text}` : ''}`)
  }

  return (await res.json()) as FleetRegistryApp[]
}

async function updateFleetApp(
  appName: string,
  metadata: Pick<FleetDatabaseMetadata, 'databaseBackend' | 'd1DatabaseName'>,
): Promise<void> {
  const res = await fetch(`${CONTROL_PLANE_URL}/api/fleet/apps/${encodeURIComponent(appName)}`, {
    method: 'PUT',
    headers: {
      ...fleetApiHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  })

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `${CONTROL_PLANE_URL}/api/fleet/apps/${appName} rejected the request. Set CONTROL_PLANE_API_KEY (nk_... admin key).`,
    )
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Could not update ${appName}: HTTP ${res.status}${text ? ` ${text}` : ''}`)
  }
}

async function resolveDesiredMetadata(
  app: FleetRegistryApp,
  dopplerApiToken?: string,
): Promise<FleetDatabaseMetadata> {
  const localMetadata = readLocalDatabaseMetadata(app.name)
  if (localMetadata) {
    return {
      databaseBackend: localMetadata.databaseBackend,
      d1DatabaseName:
        localMetadata.databaseBackend === 'postgres'
          ? null
          : localMetadata.d1DatabaseName || app.d1DatabaseName?.trim() || `${app.name}-db`,
      source: localMetadata.source,
    }
  }

  if (dopplerApiToken) {
    try {
      const secrets = await getDopplerSecrets(dopplerApiToken, app.dopplerProject, 'prd')
      const databaseBackend =
        normalizeBackend(readStringSecret(secrets, 'NUXT_DATABASE_BACKEND')) ||
        normalizeBackend(app.databaseBackend) ||
        'd1'

      return {
        databaseBackend,
        d1DatabaseName:
          databaseBackend === 'postgres'
            ? null
            : app.d1DatabaseName?.trim() ||
              readStringSecret(secrets, 'D1_DATABASE_NAME') ||
              `${app.name}-db`,
        source: 'doppler',
      }
    } catch {
      // Fall back to registry/defaults below.
    }
  }

  const databaseBackend = normalizeBackend(app.databaseBackend) || 'd1'
  return {
    databaseBackend,
    d1DatabaseName:
      databaseBackend === 'postgres' ? null : app.d1DatabaseName?.trim() || `${app.name}-db`,
    source: 'registry/default',
  }
}

async function main() {
  const filterApps = parseFilterAppsArg()
  const dopplerApiToken = process.env.DOPPLER_API_TOKEN || process.env.DOPPLER_TOKEN
  const allApps = await fetchFleetApps()
  const apps = filterApps ? allApps.filter((app) => filterApps.has(app.name)) : allApps

  if (filterApps && apps.length === 0) {
    throw new Error('No fleet apps matched --filter-apps=')
  }

  let unchanged = 0
  let updated = 0

  for (const app of apps.sort((a, b) => a.name.localeCompare(b.name))) {
    const desired = await resolveDesiredMetadata(app, dopplerApiToken)
    const currentBackend = normalizeBackend(app.databaseBackend)
    const currentD1DatabaseName = app.d1DatabaseName?.trim() || null
    const changed =
      currentBackend !== desired.databaseBackend || currentD1DatabaseName !== desired.d1DatabaseName

    if (!changed && !forceWrite) {
      console.log(`  ⏭ ${app.name.padEnd(28)} unchanged (${desired.databaseBackend}, ${desired.source})`)
      unchanged++
      continue
    }

    console.log(
      `  ${dryRun ? '…' : '✅'} ${app.name.padEnd(28)} ${String(currentBackend ?? 'null')} -> ${desired.databaseBackend}, ${String(currentD1DatabaseName ?? 'null')} -> ${String(desired.d1DatabaseName ?? 'null')}${!changed && forceWrite ? ' [forced]' : ''} (${desired.source})`,
    )

    if (!dryRun) {
      await updateFleetApp(app.name, {
        databaseBackend: desired.databaseBackend,
        d1DatabaseName: desired.d1DatabaseName,
      })
    }
    updated++
  }

  console.log('')
  console.log(
    dryRun
      ? `Dry run complete: ${updated} app(s) would update, ${unchanged} unchanged.`
      : `Sync complete: ${updated} app(s) updated, ${unchanged} unchanged.`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
