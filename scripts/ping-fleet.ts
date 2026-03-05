import { getFleetApps } from '../apps/web/server/data/fleet-registry'
import { $fetch } from 'ofetch'

async function generateTraffic() {
  const apps = getFleetApps()
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
