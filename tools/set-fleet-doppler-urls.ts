/**
 * Set Doppler secrets in each fleet app's project (prd) to match the control-plane registry.
 * Fetches the app list from the control plane API.
 *
 * Usage:
 *   npx tsx tools/set-fleet-doppler-urls.ts             # set SITE_URL in all fleet projects
 *   npx tsx tools/set-fleet-doppler-urls.ts --dry-run   # print what would be set
 *   npx tsx tools/set-fleet-doppler-urls.ts --sync-dev-ports
 *   npx tsx tools/set-fleet-doppler-urls.ts --ensure-indexnow         # set INDEXNOW_KEY (prd, and dev if empty) when missing
 *   npx tsx tools/set-fleet-doppler-urls.ts --ensure-indexnow --filter-apps=foo,bar
 *
 * Requires: doppler CLI (doppler.com/docs/cli), auth (doppler login or DOPPLER_TOKEN),
 * and write access to each fleet project in Doppler.
 *
 * GET /api/fleet/apps requires admin: set CONTROL_PLANE_API_KEY or FLEET_API_KEY (nk_...).
 */

import { randomBytes } from 'node:crypto'
import { execSync } from 'node:child_process'

const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || 'https://control-plane.nard.uk'
const dryRun = process.argv.includes('--dry-run')
const syncDevPorts = process.argv.includes('--sync-dev-ports')
const ensureIndexnow = process.argv.includes('--ensure-indexnow')

function parseFilterAppsArg(): Set<string> | null {
  const raw = process.argv
    .find((a) => a.startsWith('--filter-apps='))
    ?.slice('--filter-apps='.length)
  if (!raw) return null
  const names = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return new Set(names)
}

interface FleetApp {
  name: string
  url: string
  dopplerProject: string
  nuxtPort?: number | null
}

function fleetApiHeaders(): Record<string, string> {
  const token = process.env.CONTROL_PLANE_API_KEY ?? process.env.FLEET_API_KEY ?? ''
  const h: Record<string, string> = {}
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

async function fetchFleetApps(): Promise<FleetApp[]> {
  try {
    const res = await fetch(`${CONTROL_PLANE_URL}/api/fleet/apps`, { headers: fleetApiHeaders() })
    if (res.status === 401 || res.status === 403) {
      console.error(
        `❌ ${CONTROL_PLANE_URL}/api/fleet/apps → HTTP ${res.status}. Set CONTROL_PLANE_API_KEY (nk_... admin key).`,
      )
      process.exit(1)
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json() as Promise<FleetApp[]>
  } catch {
    console.error(`❌ Could not fetch fleet apps from ${CONTROL_PLANE_URL}/api/fleet/apps`)
    process.exit(1)
  }
}

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

/** Plain secret value, or null if missing / empty / error. */
function getSecretPlain(project: string, config: string, key: string): string | null {
  try {
    const out = execSync(
      `doppler secrets get ${key} --project "${project}" --config ${config} --plain`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
    const v = out.trim()
    return v.length > 0 ? v : null
  } catch {
    return null
  }
}

/** 32-char hex IndexNow key (same shape as template setup-analytics / provision). */
function generateIndexNowKey(): string {
  return randomBytes(16).toString('hex')
}



async function main() {
  if (!isDopplerAvailable()) {
    console.error(
      '❌ Doppler CLI not available. Install: https://docs.doppler.com/docs/install-cli',
    )
    process.exit(1)
  }

  const appsAll = await fetchFleetApps()
  let apps = appsAll
  if (ensureIndexnow) {
    const filter = parseFilterAppsArg()
    if (filter) {
      apps = appsAll.filter((a) => filter.has(a.name))
      if (apps.length === 0) {
        console.error('❌ --filter-apps= had no matching fleet registry names.')
        process.exit(1)
      }
    }
  }
  console.log('')



  if (ensureIndexnow) {
    console.log(
      dryRun
        ? 'Fleet Doppler INDEXNOW_KEY — dry run (missing prd only)'
        : 'Ensuring INDEXNOW_KEY in fleet Doppler (prd; dev filled if empty)',
    )
    console.log(
      'Each app needs its own key (served at /{key}.txt). Redeploy the Worker after changes.',
    )
    console.log(
      'If Doppler has INDEXNOW_KEY but submit still fails, ensure nuxt.config maps it to runtimeConfig.public.indexNowKey (template default) then redeploy.',
    )
    console.log('────────────────────────────────────────────────────────')

    let skipped = 0
    let set = 0
    let fail = 0

    for (const app of apps) {
      const existing = getSecretPlain(app.dopplerProject, 'prd', 'INDEXNOW_KEY')
      if (existing) {
        console.log(`  ⏭  ${app.name.padEnd(28)} INDEXNOW_KEY already set (prd)`)
        skipped++
        continue
      }

      const key = generateIndexNowKey()
      if (dryRun) {
        console.log(`  …   ${app.name.padEnd(28)} would set INDEXNOW_KEY (prd + dev if dev empty)`)
        set++
        continue
      }

      if (!setSecret(app.dopplerProject, 'prd', 'INDEXNOW_KEY', key)) {
        console.log(`  ❌ ${app.name.padEnd(28)} failed to set INDEXNOW_KEY (prd)`)
        fail++
        continue
      }

      let devNote = ''
      if (!getSecretPlain(app.dopplerProject, 'dev', 'INDEXNOW_KEY')) {
        if (setSecret(app.dopplerProject, 'dev', 'INDEXNOW_KEY', key)) {
          devNote = ' + dev'
        }
      }

      console.log(`  ✅ ${app.name.padEnd(28)} INDEXNOW_KEY set (prd${devNote})`)
      set++
    }

    console.log('────────────────────────────────────────────────────────')
    if (dryRun) {
      console.log(`Would add INDEXNOW_KEY for ${set} project(s); ${skipped} already had prd key.`)
    } else {
      console.log(`Done: ${set} updated, ${skipped} skipped, ${fail} failed.`)
    }
    console.log('')
    if (fail > 0) process.exit(1)
    return
  }

  // ── Default: SITE_URL sync ─────────────────────────────────────────────
  console.log(
    dryRun
      ? `Fleet Doppler SITE_URL${syncDevPorts ? ' + dev port' : ''} (dry run — no changes)`
      : `Setting SITE_URL${syncDevPorts ? ' + dev NUXT_PORT/SITE_URL' : ''} in fleet Doppler projects`,
  )
  console.log('────────────────────────────────────────────────────────')

  let ok = 0
  let fail = 0
  for (const app of apps) {
    const localSiteUrl = app.nuxtPort ? `http://localhost:${app.nuxtPort}` : null

    if (dryRun) {
      console.log(`  ${app.name.padEnd(28)} SITE_URL=${app.url}`)
      if (syncDevPorts) {
        if (app.nuxtPort) {
          console.log(`  ${''.padEnd(28)} dev NUXT_PORT=${app.nuxtPort} SITE_URL=${localSiteUrl}`)
        } else {
          console.log(`  ${''.padEnd(28)} dev NUXT_PORT missing in fleet registry`)
        }
      }
      ok++
      continue
    }

    const success = setSecret(app.dopplerProject, 'prd', 'SITE_URL', app.url)
    const devPortSuccess =
      !syncDevPorts ||
      (!!app.nuxtPort &&
        !!localSiteUrl &&
        setSecret(app.dopplerProject, 'dev', 'NUXT_PORT', String(app.nuxtPort)) &&
        setSecret(app.dopplerProject, 'dev', 'SITE_URL', localSiteUrl))

    if (success && devPortSuccess) {
      const devNote =
        syncDevPorts && app.nuxtPort
          ? ` | dev: NUXT_PORT=${app.nuxtPort} SITE_URL=${localSiteUrl}`
          : ''
      console.log(`  ✅ ${app.name.padEnd(28)} SITE_URL=${app.url}${devNote}`)
      ok++
    } else if (syncDevPorts && !app.nuxtPort) {
      console.log(`  ❌ ${app.name.padEnd(28)} missing nuxtPort in fleet registry`)
      fail++
    } else {
      console.log(
        `  ❌ ${app.name.padEnd(28)} failed to set${syncDevPorts ? ' prd/dev values' : ' value'} (no write access or project missing?)`,
      )
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
