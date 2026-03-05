import { chromium } from 'playwright'
import { getFleetApps } from '../apps/web/server/data/fleet-registry'

async function generateTraffic() {
  const apps = getFleetApps()
  console.log(`🚀 Launching headless browser to simulate real user visits on ${apps.length} apps...`)
  
  const browser = await chromium.launch({ headless: true })
  
  for (const app of apps) {
    const context = await browser.newContext()
    const page = await context.newPage()
    
    try {
      console.log(`🌐 Visiting: ${app.url}`)
      // Wait until network is mostly idle to ensure gtag.js loads and fires
      await page.goto(app.url, { waitUntil: 'networkidle', timeout: 30000 })
      
      // Look for the GA script injection to be absolutely sure
      const hasGtag = await page.evaluate(() => {
        return !!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')
      })
      
      if (hasGtag) {
        console.log(`  ✅ gtag.js script found injected into DOM.`)
      } else {
        console.log(`  ❌ gtag.js script MISSING from DOM!`)
      }
      
      // Wait 3 seconds on the page to ensure the ping completes
      await new Promise(r => setTimeout(r, 3000))
    } catch (e: any) {
      console.error(`  ❌ Failed to fully load ${app.url}: ${e.message}`)
    } finally {
      await context.close()
    }
  }
  
  await browser.close()
  console.log('\n✅ Traffic generation complete! The Realtime API should hit in ~10 seconds.')
}

generateTraffic()
