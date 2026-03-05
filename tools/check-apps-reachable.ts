/**
 * Check that all fleet apps are reachable (and optionally report build version/time).
 *
 * Usage:
 *   npx tsx tools/check-apps-reachable.ts
 *   npx tsx tools/check-apps-reachable.ts --urls=./fleet-urls.json   # use URL list file instead
 *   npx tsx tools/check-apps-reachable.ts --timeout=15
 *
 * By default, fetches the app list from the deployed control plane API.
 * With --urls=path: JSON file with { "app-name": "https://..." } or [ "https://...", ... ].
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const urlListPath = args.find((a) => a.startsWith('--urls='))?.slice(7)
const timeoutSec = Number(args.find((a) => a.startsWith('--timeout='))?.slice(10) || '10') * 1000

const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || 'https://control-plane.nard.uk'

interface FleetApp {
  name: string
  url: string
  dopplerProject: string
}

async function fetchFleetApps(): Promise<[string, string][]> {
  try {
    const res = await fetch(`${CONTROL_PLANE_URL}/api/fleet/apps`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const apps = (await res.json()) as FleetApp[]
    return apps.map((a) => [a.name, a.url])
  } catch {
    console.error(`⚠️ Could not fetch fleet apps from ${CONTROL_PLANE_URL}/api/fleet/apps`)
    console.error('   Ensure the control plane is deployed and accessible.')
    process.exit(1)
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
  } else {
    entries = await fetchFleetApps()
    if (entries.length === 0) {
      console.error('No fleet apps found. Check control plane API.')
      process.exit(1)
    }
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
