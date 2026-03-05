/**
 * Diagnose GA4 data access for all fleet apps.
 * Fetches the fleet app list from the control plane API.
 *
 * Usage: npx tsx scripts/diagnose-ga-data.ts
 */
import { googleApiFetch } from '../layers/narduk-nuxt-layer/server/utils/google'

// Mock runtime config for googleApiFetch
globalThis.useRuntimeConfig = () => ({
  googleServiceAccountKey: process.env.GSC_SERVICE_ACCOUNT_JSON || ''
})

const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || 'https://control-plane.nard.uk'
const SCOPES = ['https://www.googleapis.com/auth/analytics.readonly']

interface FleetApp { name: string; url: string; dopplerProject: string; gaPropertyId?: string | null }

async function fetchFleetApps(): Promise<FleetApp[]> {
  try {
    const res = await fetch(`${CONTROL_PLANE_URL}/api/fleet/apps`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json() as Promise<FleetApp[]>
  } catch {
    console.error(`❌ Could not fetch fleet apps from ${CONTROL_PLANE_URL}/api/fleet/apps`)
    process.exit(1)
  }
}

async function testGAProperty(appId: string, propertyId: string) {
  console.log(`\n--- Querying GA for ${appId} (Property: ${propertyId}) ---`)

  try {
    const response = await googleApiFetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`, SCOPES, {
      method: 'POST',
      body: JSON.stringify({
        metrics: [{ name: 'activeUsers' }]
      })
    })

    if (!response.rows || response.rows.length === 0) {
      console.log(`⚠️  Property ${propertyId} has ZERO active users in the last 30 minutes.`)
    } else {
      console.log(`✅ Found realtime data! Active users: ${response.rows[0].metricValues[0].value}`)
    }

  } catch (err: any) {
    console.error(`❌ Failed to query GA for ${appId}: ${err.message || err.statusText}`)
    if (err.body) console.error(err.body)
  }
}

async function main() {
  const apps = await fetchFleetApps()
  for (const app of apps) {
    if (app.gaPropertyId) {
      await testGAProperty(app.dopplerProject, app.gaPropertyId)
    }
  }
}

main()
