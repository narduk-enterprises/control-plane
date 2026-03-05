import { getFleetApps } from '../apps/web/server/data/fleet-registry'
import { googleApiFetch } from '../layers/narduk-nuxt-layer/server/utils/google'
import { $fetch } from 'ofetch'

// Mock runtime config for googleApiFetch
globalThis.useRuntimeConfig = () => ({
  googleServiceAccountKey: process.env.GSC_SERVICE_ACCOUNT_JSON || ''
})

const siteVerificationUrl = 'https://www.googleapis.com/siteVerification/v1/webResource'
const SCOPES = ['https://www.googleapis.com/auth/analytics.readonly']

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
  const apps = getFleetApps()
  for (const app of apps) {
    if (app.gaPropertyId) {
      await testGAProperty(app.dopplerProject, app.gaPropertyId)
    }
  }
}

main()
