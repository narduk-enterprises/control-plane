import { chromium } from 'playwright'
import { getFleetApps } from '../apps/web/server/data/fleet-registry'

async function checkPosthog() {
  const apps = getFleetApps()
  console.log(`🚀 Launching headless browser to check PostHog on ${apps.length} apps...`)
  
  const browser = await chromium.launch({ headless: true })
  
  for (const app of apps) {
    const context = await browser.newContext()
    const page = await context.newPage()
    
    let posthogAppProperty = null
    let phRequestFound = false
    
    page.on('request', req => {
      const url = req.url()
      // PostHog sends data to its API usually via /e/ or /s/ or /capture/ endpoints
      if (url.includes('posthog.com') || url.includes('us.i.posthog.com')) {
        phRequestFound = true
        const postData = req.postDataJSON()
        if (postData && postData.properties && postData.properties.app) {
          posthogAppProperty = postData.properties.app
        } else if (postData && postData.properties && postData.properties.$set && postData.properties.$set.app) {
          posthogAppProperty = postData.properties.$set.app
        } else if (url.includes('data=')) {
          // sometimes it's base64 encoded in the URL or payload if not JSON
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
      
      await new Promise(r => setTimeout(r, 2000))
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
