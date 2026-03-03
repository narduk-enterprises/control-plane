/**
 * Check that all fleet apps are reachable (and optionally report build version/time).
 *
 * Usage:
 *   npx tsx tools/check-apps-reachable.ts
 *   npx tsx tools/check-apps-reachable.ts --urls=./fleet-urls.json   # use URL list file instead of Doppler
 *   npx tsx tools/check-apps-reachable.ts --timeout=15
 *
 * With Doppler: reads SITE_URL from each project's prd config (same project list as sync bot).
 * With --urls=path: JSON file with { "app-name": "https://..." } or [ "https://...", ... ].
 */

import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const urlListPath = args.find((a) => a.startsWith('--urls='))?.slice(7)
const timeoutSec = Number(args.find((a) => a.startsWith('--timeout='))?.slice(10) || '10') * 1000

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

function isDopplerAvailable(): boolean {
  try {
    execSync('doppler --version', { encoding: 'utf-8', stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function getDopplerSiteUrl(project: string): string | null {
  try {
    const out = execSync(
      `doppler secrets get SITE_URL --project "${project}" --config prd --plain 2>/dev/null`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
    const url = out.trim()
    return url && url.startsWith('http') ? url : null
  } catch {
    return null
  }
}

function loadUrlsFromFile(path: string): Record<string, string> {
  const abs = resolve(process.cwd(), path)
  if (!existsSync(abs)) {
    console.error(`File not found: ${abs}`)
    process.exit(1)
  }
  const raw = readFileSync(abs, 'utf-8')
  const data = JSON.parse(raw) as Record<string, string> | string[]
  if (Array.isArray(data)) {
    return Object.fromEntries(data.map((url, i) => [`app-${i}`, url]))
  }
  return data
}

async function fetchWithTimeout(url: string, ms: number): Promise<{ ok: boolean; status: number; duration: number; buildVersion?: string; buildTime?: string }> {
  const start = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'NardukFleetReachabilityCheck/1.0' },
    })
    const duration = Date.now() - start
    clearTimeout(timeout)
    let buildVersion: string | undefined
    let buildTime: string | undefined
    if (res.ok) {
      const html = await res.text()
      const versionMatch = html.match(/<meta\s+name="build-version"\s+content="([^"]*)"/i)
      const timeMatch = html.match(/<meta\s+name="build-time"\s+content="([^"]*)"/i)
      if (versionMatch) buildVersion = versionMatch[1]
      if (timeMatch) buildTime = timeMatch[1]
    }
    return { ok: res.ok, status: res.status, duration, buildVersion, buildTime }
  } catch (e) {
    clearTimeout(timeout)
    const duration = Date.now() - start
    const ok = false
    const status = (e as { cause?: { code?: string } })?.cause?.code === 'ABORT_ERR' ? 0 : -1
    return { ok, status, duration }
  }
}

async function main() {
  let entries: [string, string][]

  if (urlListPath) {
    const obj = loadUrlsFromFile(urlListPath)
    entries = Object.entries(obj)
  } else if (isDopplerAvailable()) {
    entries = FLEET_PROJECTS.map((name) => [name, getDopplerSiteUrl(name) ?? '']).filter(
      (e): e is [string, string] => !!e[1],
    )
    if (entries.length === 0) {
      console.error('No SITE_URL found for any Doppler project. Check Doppler CLI auth and prd config.')
      process.exit(1)
    }
  } else {
    console.error('Doppler CLI not available and no --urls= file provided.')
    console.error('  Install Doppler CLI, or run with: --urls=./fleet-urls.json')
    process.exit(1)
  }

  console.log('')
  console.log('Fleet reachability check')
  console.log('────────────────────────')
  const results: { name: string; url: string; ok: boolean; status: number; duration: number; buildVersion?: string; buildTime?: string }[] = []

  for (const [name, url] of entries) {
    const r = await fetchWithTimeout(url, timeoutSec)
    results.push({
      name,
      url,
      ok: r.ok,
      status: r.status,
      duration: r.duration,
      buildVersion: r.buildVersion,
      buildTime: r.buildTime,
    })
    const status = r.ok ? `✅ ${r.status}` : `❌ ${r.status || 'timeout'}`
    const extra = r.buildTime ? `  build: ${r.buildTime}` : ''
    console.log(`${status}  ${name.padEnd(28)}  ${r.duration}ms  ${url}${extra}`)
  }

  console.log('────────────────────────')
  const failed = results.filter((r) => !r.ok)
  if (failed.length > 0) {
    console.log(`Failed: ${failed.length}/${results.length}`)
    process.exit(1)
  }
  console.log(`All ${results.length} apps reachable.`)
  console.log('')
}

main()
