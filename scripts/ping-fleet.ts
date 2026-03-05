/**
 * Ping all fleet apps to simulate page views.
 * Fetches the fleet app list from the control plane API.
 *
 * Usage: npx tsx scripts/ping-fleet.ts
 */
import { $fetch } from 'ofetch'

const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || 'https://control-plane.nard.uk'

interface FleetApp { name: string; url: string }

async function generateTraffic() {
  let apps: FleetApp[]
  try {
    apps = await $fetch<FleetApp[]>(`${CONTROL_PLANE_URL}/api/fleet/apps`)
  } catch (err: any) {
    console.error(`❌ Could not fetch fleet apps from ${CONTROL_PLANE_URL}/api/fleet/apps: ${err.message}`)
    process.exit(1)
  }

  console.log(`🚀 Simulating page views on ${apps.length} applications...`)
  
  await Promise.allSettled(apps.map(async (app) => {
    try {
      await $fetch(app.url)
      console.log(`✅ Loaded ${app.url}`)
    } catch (e: any) {
      console.error(`❌ Failed to load ${app.url}: ${e.message}`)
    }
  }))
  
  console.log('\n✅ Traffic generation complete! The GA tracking script needs a real browser to fire `gtag.js` via CSR though...')
}

generateTraffic()
