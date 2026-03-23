/**
 * POST /api/fleet/indexnow/:app for every fleet app (records pings in control-plane D1).
 *
 * Requires an admin API key (Authorization: Bearer nk_...).
 *
 *   CONTROL_PLANE_URL=https://control-plane.example.com \
 *   CONTROL_PLANE_API_KEY=nk_... \
 *   npx tsx tools/fleet-indexnow-submit-all.ts
 */
const base = (process.env.CONTROL_PLANE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const token = process.env.CONTROL_PLANE_API_KEY ?? process.env.FLEET_API_KEY ?? ''

interface FleetRow {
  name: string
}

async function main() {
  if (!token) {
    console.error('Set CONTROL_PLANE_API_KEY or FLEET_API_KEY (Bearer nk_... admin key).')
    process.exit(1)
  }

  const auth = { Authorization: `Bearer ${token}` }

  const listRes = await fetch(`${base}/api/fleet/apps`, { headers: auth })
  if (!listRes.ok) {
    console.error(`GET /api/fleet/apps → HTTP ${listRes.status}`)
    process.exit(1)
  }

  const apps = (await listRes.json()) as FleetRow[]
  console.log(`Submitting IndexNow for ${apps.length} app(s) via ${base}…\n`)

  let ok = 0
  let fail = 0

  for (const app of apps) {
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
