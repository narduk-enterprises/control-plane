/**
 * Validate that all fleet apps have required Doppler secrets (e.g. SITE_URL).
 * Run from the template repo so we catch missing config before check:reach or deploy.
 *
 * Usage:
 *   pnpm run check:fleet-doppler
 *
 * Fetches the monitored repo list from the deployed control plane API.
 * For fleet-wide read access, set FLEET_DOPPLER_TOKEN in the template's Doppler
 * project (prd) to a service token with read access to all fleet projects; the
 * script uses it when present for doppler secrets calls.
 */

import { execSync } from 'node:child_process'

// Use fleet-wide token from Doppler context when available (set in template project)
if (process.env.FLEET_DOPPLER_TOKEN) {
  process.env.DOPPLER_TOKEN = process.env.FLEET_DOPPLER_TOKEN
}

const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || 'https://control-plane.nard.uk'

interface FleetApp {
  name: string
  url: string
  dopplerProject: string
}

async function fetchFleetApps(): Promise<FleetApp[]> {
  const apiKey = process.env.CONTROL_PLANE_API_KEY || process.env.FLEET_API_KEY
  try {
    const res = await fetch(
      `${CONTROL_PLANE_URL}/api/fleet/repos?includeInactive=true&monitoringEnabled=true`,
      {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json() as Promise<FleetApp[]>
  } catch (err) {
    console.error(`⚠️ Could not fetch fleet repos from ${CONTROL_PLANE_URL}/api/fleet/repos`)
    console.error(
      '   Ensure the control plane is deployed and accessible, or set CONTROL_PLANE_URL.',
    )
    process.exit(1)
  }
}

const REQUIRED_SECRETS = [
  'SITE_URL',
  'POSTHOG_PUBLIC_KEY',
  'POSTHOG_HOST',
  'GA_MEASUREMENT_ID',
] as const

function isDopplerAvailable(): boolean {
  try {
    execSync('doppler --version', { encoding: 'utf-8', stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function getSecretNames(project: string, config: string): Set<string> | null {
  try {
    const out = execSync(
      `doppler secrets --project "${project}" --config ${config} --only-names --plain`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
    return new Set(out.trim().split('\n').filter(Boolean))
  } catch {
    return null
  }
}

async function checkInheritance(project: string, config: string): Promise<boolean | null> {
  const token = process.env.DOPPLER_TOKEN || process.env.DOPPLER_API_TOKEN
  if (!token) return null
  try {
    const res = await fetch(
      `https://api.doppler.com/v3/configs/config?project=${project}&config=${config}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    if (!res.ok) return null
    const data = (await res.json()) as any
    const inherits = data.config?.inherits || []
    return inherits.some((i: any) => i.project === 'narduk-nuxt-template' && i.config === 'prd')
  } catch {
    return null
  }
}

async function main() {
  if (!isDopplerAvailable()) {
    console.error(
      '❌ Doppler CLI not available. Install and log in: https://docs.doppler.com/docs/install-cli',
    )
    process.exit(1)
  }

  const apps = await fetchFleetApps()

  console.log('')
  console.log(`Fleet Doppler validation (${apps.length} apps, required secrets in prd)`)
  console.log('────────────────────────────────────────────────')
  let failed = 0
  let noAccess = 0
  for (const app of apps) {
    const project = app.dopplerProject
    const names = getSecretNames(project, 'prd')
    if (names === null) {
      console.log(`  ⚠️ ${project.padEnd(28)} unable to read (no Doppler access to this project)`)
      noAccess++
      continue
    }
    const missing = REQUIRED_SECRETS.filter((s) => !names.has(s))
    const inheritsPrd = await checkInheritance(project, 'prd')
    const inheritsDev = await checkInheritance(project, 'dev')

    const hasInheritanceError = inheritsPrd === false || inheritsDev === false

    if (missing.length > 0 || hasInheritanceError) {
      console.log(
        `  ❌ ${project.padEnd(28)}${missing.length > 0 ? ` missing secrets: ${missing.join(', ')}` : ''}${hasInheritanceError ? ` missing inheritance` : ''}`,
      )
      failed++
    } else {
      console.log(`  ✅ ${project.padEnd(28)} (inherits hub/prd)`)
    }
  }
  console.log('────────────────────────────────────────────────')
  if (noAccess > 0) {
    console.error(
      `\n⚠️ ${noAccess} project(s) could not be read. Use a Doppler token with access to all fleet projects`,
    )
    console.error(
      '   (e.g. run from a directory with doppler setup for a project that has access, or use a service token).',
    )
    process.exit(1)
  }
  if (failed > 0) {
    console.error(`\n❌ ${failed} project(s) missing required Doppler secrets (prd).`)
    console.error('   Required: SITE_URL, POSTHOG_PUBLIC_KEY, POSTHOG_HOST, GA_MEASUREMENT_ID')
    console.error('   Fix per-app: doppler secrets set KEY="value" --project <name> --config prd')
    console.error('   Or use hub refs: npx tsx tools/set-fleet-doppler-urls.ts --sync-analytics')
    process.exit(1)
  }
  console.log('\n✅ All fleet projects have required secrets.')
  console.log('')
}

main()
