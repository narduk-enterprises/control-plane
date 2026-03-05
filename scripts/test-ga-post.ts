import { $fetch } from 'ofetch'

const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || 'https://control-plane.nard.uk'
interface FleetApp { name: string; url: string; dopplerProject: string; gaPropertyId?: string | null }

async function sendManualEvent() {
  let apps: FleetApp[]
  try {
    apps = await $fetch<FleetApp[]>(`${CONTROL_PLANE_URL}/api/fleet/apps`)
  } catch {
    console.error(`❌ Could not fetch fleet apps from ${CONTROL_PLANE_URL}/api/fleet/apps`)
    process.exit(1)
  }

  // Circuit Breaker Sales
  const app = apps.find(a => a.name === 'circuit-breaker-online')!

  const measurementId = 'G-8WZ93XNKHX' // From Circuit Breaker
  
  // Simulate the exact GET request gtag.js makes to /g/collect
  const cid = Math.random().toString(36).substring(2) + '.' + Date.now()
  const sid = Math.floor(Date.now() / 1000)
  
  const url = `https://www.google-analytics.com/g/collect?v=2&tid=${measurementId}&cid=${cid}&en=page_view&dl=https%3A%2F%2Fcircuitbreaker.online%2F&dt=Circuit%20Breaker%20Online&sid=${sid}&sct=1`
  
  console.log('Sending direct HTTP payload to GA4 Collection endpoint...')
  console.log(url)
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })
    console.log(`Status: ${res.status} ${res.statusText}`)
  } catch (e: any) {
    console.log('Error:', e.message)
  }
}

sendManualEvent()
