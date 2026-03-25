/**
 * POST /api/fleet/indexnow/:app for every fleet app (records pings in control-plane D1).
 *
 * Requires an admin API key (Authorization: Bearer nk_...).
 *
 * Control plane enforces `fleet-indexnow` at 10 requests / 60s per client IP; this script
 * waits between apps by default so long runs do not hit 429.
 *
 *   CONTROL_PLANE_URL=https://control-plane.example.com \
 *   CONTROL_PLANE_API_KEY=nk_... \
 *   FLEET_INDEXNOW_DELAY_MS=7000 \
 *   npx tsx tools/fleet-indexnow-submit-all.ts
 */
const localPort = Number(process.env.NUXT_PORT || 3000)
const localBaseUrl = `http://localhost:${Number.isFinite(localPort) ? localPort : 3000}`
const base = (process.env.CONTROL_PLANE_URL ?? localBaseUrl).replace(/\/$/, '')
const token = process.env.CONTROL_PLANE_API_KEY ?? process.env.FLEET_API_KEY ?? ''

const DEFAULT_DELAY_MS = 7_000

function parseDelayMs(): number {
  const raw = process.env.FLEET_INDEXNOW_DELAY_MS
  if (raw === undefined || raw === '') return DEFAULT_DELAY_MS
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return DEFAULT_DELAY_MS
  return n
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface FleetRow {
  name: string
}

async function main() {
  if (!token) {
    console.error('Set CONTROL_PLANE_API_KEY or FLEET_API_KEY (Bearer nk_... admin key).')
    process.exit(1)
  }

  const auth = { Authorization: `Bearer ${token}` }

  const listRes = await fetch(`${base}/api/fleet/repos?includeInactive=true&monitoringEnabled=true`, {
    headers: auth,
  })
  if (!listRes.ok) {
    console.error(`GET /api/fleet/repos → HTTP ${listRes.status}`)
    process.exit(1)
  }

  const apps = (await listRes.json()) as FleetRow[]
  const delayMs = parseDelayMs()
  console.log(`Submitting IndexNow for ${apps.length} app(s) via ${base}…`)
  console.log(
    `Throttle: ${delayMs}ms between apps (stay under fleet-indexnow 10 req / 60s). Set FLEET_INDEXNOW_DELAY_MS to override.\n`,
  )

  let ok = 0
  let fail = 0

  for (let i = 0; i < apps.length; i++) {
    const app = apps[i]!
    if (i > 0 && delayMs > 0) await sleep(delayMs)

    const res = await fetch(`${base}/api/fleet/indexnow/${encodeURIComponent(app.name)}`, {
      method: 'POST',
      headers: {
        ...auth,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: '{}',
    })

    if (res.ok) {
      ok++
      console.log(`  ✅ ${app.name}`)
    } else {
      fail++
      let detail = ''
      try {
        const body = (await res.json()) as { message?: string }
        detail = body.message ? ` — ${body.message}` : ''
      } catch {
        /* ignore */
      }
      console.log(`  ❌ ${app.name} (HTTP ${res.status})${detail}`)
    }
  }

  console.log(`\nDone. OK: ${ok}, failed: ${fail}`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
