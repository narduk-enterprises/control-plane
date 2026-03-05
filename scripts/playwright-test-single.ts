import { chromium } from 'playwright'

async function checkSingle() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  
  let phRequestFound = false
  let posthogAppProperty = null
  
  page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`))
  page.on('pageerror', err => console.log(`[Browser Error] ${err.message}`))
  page.on('requestfailed', request => console.log(`[Request Failed] ${request.url()} - ${request.failure()?.errorText}`))

  page.on('request', req => {
    const url = req.url()
    console.log(`[Network] ${req.method()} ${url}`)
    
    if (url.includes('posthog') || url.includes('/e/')) {
        phRequestFound = true
        let payload = null
        
        if (req.method() === 'POST') {
          try {
            payload = req.postDataJSON()
          } catch(e) { }
        } else if (req.method() === 'GET') {
          const defaultUrl = new URL(url)
          const data = defaultUrl.searchParams.get('data')
          if (data) {
            try {
              payload = JSON.parse(Buffer.from(data, 'base64').toString('utf8'))
            } catch(e) { }
          }
        }
        
        if (payload) {
          if (payload.properties && payload.properties.app) {
            posthogAppProperty = payload.properties.app
          } else if (payload.properties && payload.properties.$set && payload.properties.$set.app) {
            posthogAppProperty = payload.properties.$set.app
          } else if (payload.$set && payload.$set.app) {
            posthogAppProperty = payload.$set.app
          }
        }
    }
  })
  
  console.log(`🌐 Visiting: http://localhost:3002`)
  await page.goto('http://localhost:3002', { waitUntil: 'networkidle', timeout: 30000 })
  
  const nuxtConfig = await page.evaluate(() => {
    return (window as any).__NUXT__ || {}
  })
  // console.log('__NUXT__:', JSON.stringify(nuxtConfig, null, 2))
  
  await page.evaluate(() => {
    console.log('Manually calling posthog.capture')
    if ((window as any).posthog) {
      (window as any).posthog.capture('playwright_test')
    } else {
      console.log('window.posthog is missing natively on the page')
    }
  })
  
  await new Promise(r => setTimeout(r, 5000))
  
  if (phRequestFound) {
    if (posthogAppProperty) {
      console.log(`✅ SUCCESS - PostHog app property: ${posthogAppProperty}`)
    } else {
      console.log(`❌ FAILED - PostHog app property is still missing!`)
    }
  } else {
    console.log(`❌ FAILED - PostHog requests missing!`)
  }
  
  await browser.close()
}

checkSingle()
