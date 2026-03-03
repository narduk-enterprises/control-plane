/**
 * Validate that all fleet apps have required Doppler secrets (e.g. SITE_URL).
 * Run from the template repo so we catch missing config before check:reach or deploy.
 *
 * Usage:
 *   pnpm run check:fleet-doppler
 *
 * This runs under `doppler run`, so the template project's secrets are available.
 * For fleet-wide read access, set FLEET_DOPPLER_TOKEN in the template's Doppler
 * project (prd) to a service token with read access to all fleet projects; the
 * script uses it when present for doppler secrets calls.
 */

import { execSync } from 'node:child_process'

// Use fleet-wide token from Doppler context when available (set in template project)
if (process.env.FLEET_DOPPLER_TOKEN) {
  process.env.DOPPLER_TOKEN = process.env.FLEET_DOPPLER_TOKEN
}

const FLEET_PROJECTS = [
  'neon-sewer-raid',
  'old-austin-grouch',
  'ogpreview-app',
  'imessage-dictionary',
  'narduk-enterprises-portfolio',
  'drift-map',
  'tiny-invoice',
  'enigma-box',
  'papa-everetts-pizza',
  'flashcard-pro',
  'clawdle',
  'circuit-breaker-online',
  'nagolnagemluapleira',
  'austin-texas-net',
]

const REQUIRED_SECRETS = ['SITE_URL'] as const

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

function main() {
  if (!isDopplerAvailable()) {
    console.error('❌ Doppler CLI not available. Install and log in: https://docs.doppler.com/docs/install-cli')
    process.exit(1)
  }

  console.log('')
  console.log('Fleet Doppler validation (required secrets in prd)')
  console.log('────────────────────────────────────────────────')
  let failed = 0
  let noAccess = 0
  for (const project of FLEET_PROJECTS) {
    const names = getSecretNames(project, 'prd')
    if (names === null) {
      console.log(`  ⚠️ ${project.padEnd(28)} unable to read (no Doppler access to this project)`)
      noAccess++
      continue
    }
    const missing = REQUIRED_SECRETS.filter((s) => !names.has(s))
    if (missing.length > 0) {
      console.log(`  ❌ ${project.padEnd(28)} missing: ${missing.join(', ')}`)
      failed++
    } else {
      console.log(`  ✅ ${project}`)
    }
  }
  console.log('────────────────────────────────────────────────')
  if (noAccess > 0) {
    console.error(`\n⚠️ ${noAccess} project(s) could not be read. Use a Doppler token with access to all fleet projects`)
    console.error('   (e.g. run from a directory with doppler setup for a project that has access, or use a service token).')
    process.exit(1)
  }
  if (failed > 0) {
    console.error(`\n❌ ${failed} project(s) missing required Doppler secrets (prd).`)
    console.error('   Fix: doppler secrets set SITE_URL="https://..." --project <name> --config prd')
    process.exit(1)
  }
  console.log('\n✅ All fleet projects have required secrets.')
  console.log('')
}

main()
