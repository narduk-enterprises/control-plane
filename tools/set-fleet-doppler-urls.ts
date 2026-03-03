/**
 * Set SITE_URL in each fleet app's Doppler project (prd) to match the control-plane registry.
 * Run from control-plane root with Doppler CLI installed and write access to each project.
 *
 * Usage:
 *   npx tsx tools/set-fleet-doppler-urls.ts           # set SITE_URL in all fleet projects
 *   npx tsx tools/set-fleet-doppler-urls.ts --dry-run # print what would be set
 *
 * Requires: doppler CLI (doppler.com/docs/cli), auth (doppler login or DOPPLER_TOKEN),
 * and write access to each fleet project in Doppler.
 */

import { execSync } from 'node:child_process'
import { getFleetApps } from '../apps/web/server/data/fleet-registry'

const dryRun = process.argv.includes('--dry-run')

function isDopplerAvailable(): boolean {
  try {
    execSync('doppler --version', { encoding: 'utf-8', stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function setSecret(project: string, config: string, key: string, value: string): boolean {
  try {
    execSync(
      `doppler secrets set ${key}="${value.replace(/"/g, '\\"')}" --project "${project}" --config ${config} --silent`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
    return true
  } catch {
    return false
  }
}

function main() {
  if (!isDopplerAvailable()) {
    console.error('❌ Doppler CLI not available. Install: https://docs.doppler.com/docs/install-cli')
    process.exit(1)
  }

  const apps = getFleetApps()
  console.log('')
  console.log(dryRun ? 'Fleet Doppler SITE_URL (dry run — no changes)' : 'Setting SITE_URL in fleet Doppler projects (prd)')
  console.log('────────────────────────────────────────────────────────')

  let ok = 0
  let fail = 0
  for (const app of apps) {
    if (dryRun) {
      console.log(`  ${app.name.padEnd(28)} SITE_URL=${app.url}`)
      ok++
      continue
    }
    const success = setSecret(app.name, 'prd', 'SITE_URL', app.url)
    if (success) {
      console.log(`  ✅ ${app.name.padEnd(28)} SITE_URL=${app.url}`)
      ok++
    } else {
      console.log(`  ❌ ${app.name.padEnd(28)} failed to set (no write access or project missing?)`)
      fail++
    }
  }

  console.log('────────────────────────────────────────────────────────')
  if (dryRun) {
    console.log(`Would set SITE_URL for ${ok} projects. Run without --dry-run to apply.`)
  } else {
    console.log(`Done: ${ok} updated, ${fail} failed.`)
  }
  console.log('')
  if (fail > 0) process.exit(1)
}

main()
