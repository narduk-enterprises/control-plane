import { firefox } from 'playwright'

const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || 'https://control-plane.nard.uk'
interface FleetApp { name: string; url: string }

async function checkPosthog() {
  let apps: FleetApp[]
  try {
    const res = await fetch(`${CONTROL_PLANE_URL}/api/fleet/apps`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    apps = await res.json() as FleetApp[]
  } catch {
    console.error(`❌ Could not fetch fleet apps from ${CONTROL_PLANE_URL}/api/fleet/apps`)
    process.exit(1)
  }

  console.log(`🚀 Launching headless browser to check PostHog on ${apps.length} apps...`)
  
  const browser = await firefox.launch({ headless: true })
  
  for (const app of apps) {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0'
    })
    const page = await context.newPage()
    
    let posthogAppProperty = null
    let phRequestFound = false
    
    page.on('request', req => {
      const url = req.url()
      // PostHog sends data to its API usually via /e/ or /s/ or /capture/ endpoints
      if (url.includes('posthog.com') || url.includes('us.i.posthog.com')) {
        phRequestFound = true
        let payload: any = null
        try { payload = req.postDataJSON() } catch(e) {}
        
        if (payload) {
          // Check for top-level properties
          if (payload.properties?.app) posthogAppProperty = payload.properties.app
          else if (payload.properties?.$set?.app) posthogAppProperty = payload.properties.$set.app
          else if (payload.$set?.app) posthogAppProperty = payload.$set.app
          
          // Check for batched events
          if (payload.batch && Array.isArray(payload.batch)) {
            for (const event of payload.batch) {
              if (event.properties?.app) posthogAppProperty = event.properties.app
              else if (event.properties?.$set?.app) posthogAppProperty = event.properties.$set.app
            }
          }
        }
      }
    })
    
    try {
      console.log(`🌐 Visiting: ${app.url}`)
      await page.goto(app.url, { waitUntil: 'networkidle', timeout: 30000 })
      
      if (phRequestFound) {
        console.log(`  ✅ PostHog network request intercepted.`)
        if (posthogAppProperty) {
          console.log(`  ✅ PostHog 'app' property: ${posthogAppProperty}`)
        } else {
          console.log(`  ❌ PostHog 'app' property is MISSING or null in the payload!`)
        }
      } else {
        console.log(`  ❌ PostHog network requests MISSING entirely!`)
      }
      
      await new Promise(r => setTimeout(r, 6000))
    } catch (e: any) {
      console.error(`  ❌ Failed to fully load ${app.url}: ${e.message}`)
    } finally {
      await context.close()
    }
  }
  
  await browser.close()
  console.log('\n✅ PostHog checks complete.')
}

checkPosthog()
