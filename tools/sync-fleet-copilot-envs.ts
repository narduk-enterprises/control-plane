import { createDopplerServiceToken } from '../apps/web/server/utils/provision-doppler'
import { runCommand } from './command'

interface FleetApp {
  name: string
  githubRepo?: string | null
}

function parseArgs(argv: string[]): {
  appName?: string
  githubRepo?: string
  dopplerConfig: string
  ghEnv: string
  allSecrets: boolean
  dryRun: boolean
  org: string
} {
  const parsed = {
    dopplerConfig: 'prd_copilot',
    ghEnv: 'copilot',
    allSecrets: false,
    dryRun: false,
    org: 'narduk-enterprises',
  }

  for (const arg of argv) {
    if (arg === '--all-secrets') {
      parsed.allSecrets = true
      continue
    }
    if (arg === '--dry-run') {
      parsed.dryRun = true
      continue
    }
    if (arg.startsWith('--app-name=')) {
      parsed.appName = arg.slice('--app-name='.length)
      continue
    }
    if (arg.startsWith('--github-repo=')) {
      parsed.githubRepo = arg.slice('--github-repo='.length)
      continue
    }
    if (arg.startsWith('--doppler-config=')) {
      parsed.dopplerConfig = arg.slice('--doppler-config='.length)
      continue
    }
    if (arg.startsWith('--env=')) {
      parsed.ghEnv = arg.slice('--env='.length)
      continue
    }
    if (arg.startsWith('--org=')) {
      parsed.org = arg.slice('--org='.length)
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return parsed
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

async function fetchFleetApps(baseUrl: string, apiKey: string): Promise<FleetApp[]> {
  const url = new URL('/api/fleet/repos?syncManaged=true&includeInactive=true', baseUrl)
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Fleet repo list fetch failed: ${response.status} ${text}`)
  }

  return (await response.json()) as FleetApp[]
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const controlPlaneUrl = requireEnv('CONTROL_PLANE_URL')
  const controlPlaneApiKey =
    process.env.CONTROL_PLANE_API_KEY?.trim() || process.env.FLEET_API_KEY?.trim()
  if (!controlPlaneApiKey) {
    throw new Error('Missing CONTROL_PLANE_API_KEY or FLEET_API_KEY')
  }
  const dopplerApiToken =
    process.env.DOPPLER_API_TOKEN?.trim() ||
    process.env.DOPPLER_TOKEN?.trim() ||
    process.env.APP_DOPPLER_TOKEN?.trim()
  if (!dopplerApiToken) {
    throw new Error('Missing DOPPLER_API_TOKEN, DOPPLER_TOKEN, or APP_DOPPLER_TOKEN')
  }
  const ghToken =
    process.env.GH_SERVICE_TOKEN?.trim() ||
    process.env.CONTROL_PLANE_GH_SERVICE_TOKEN?.trim() ||
    process.env.GH_TOKEN?.trim()
  if (!ghToken) {
    throw new Error('Missing GH_SERVICE_TOKEN, CONTROL_PLANE_GH_SERVICE_TOKEN, or GH_TOKEN')
  }

  const fleetApps = await fetchFleetApps(controlPlaneUrl, controlPlaneApiKey)
  const targets = args.appName
    ? fleetApps.filter((app) => app.name === args.appName)
    : fleetApps.filter((app) => Boolean(app.githubRepo))

  if (args.appName && targets.length === 0) {
    throw new Error(`Fleet app not found: ${args.appName}`)
  }
  if (targets.length === 0) {
    console.log('No fleet apps matched the sync request.')
    return
  }

  const failures: string[] = []

  for (const app of targets) {
    const repo = args.githubRepo || app.githubRepo || `${args.org}/${app.name}`
    console.log(`\n==> Syncing ${app.name} → ${repo}`)

    try {
      const dopplerTokenForSync = args.dryRun
        ? dopplerApiToken
        : await createDopplerServiceToken(
            dopplerApiToken,
            app.name,
            args.dopplerConfig,
            'copilot-sync',
          )

      const syncArgs = [
        'exec',
        'tsx',
        'tools/sync-copilot-secrets.ts',
        app.name,
        `--doppler-config=${args.dopplerConfig}`,
        `--github-repo=${repo}`,
        `--env=${args.ghEnv}`,
      ]
      if (args.allSecrets) {
        syncArgs.push('--all-secrets')
      }
      if (args.dryRun) {
        syncArgs.push('--dry-run')
      }

      runCommand('pnpm', syncArgs, {
        stdio: 'inherit',
        env: {
          ...process.env,
          DOPPLER_TOKEN: dopplerTokenForSync,
          GH_TOKEN: ghToken,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`${app.name}: ${message}`)
      console.error(`❌ ${app.name}: ${message}`)
    }
  }

  if (failures.length > 0) {
    throw new Error(`Copilot sync failed for ${failures.length} app(s): ${failures.join(' | ')}`)
  }

  console.log(`\n✅ Copilot sync complete for ${targets.length} app(s).`)
}

main().catch((error) => {
  console.error('❌ Fleet Copilot sync failed:', error)
  process.exit(1)
})
