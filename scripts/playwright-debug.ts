import { chromium } from 'playwright'

async function debugGA() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()
  
  page.on('console', msg => {
    console.log(`[Browser Console]: ${msg.text()}`)
  })
  
  page.on('request', req => {
    const url = req.url()
    if (url.includes('google-analytics.com') || url.includes('googletagmanager') || url.includes('analytics')) {
      console.log(`[GA Network Request]: ${req.method()} ${url}`)
    }
  })
  page.on('response', async res => {
    const url = res.url()
    if (url.includes('google-analytics.com') || url.includes('googletagmanager') || url.includes('analytics')) {
      console.log(`[GA Network Response]: ${res.status()} ${url}`)
    }
  })

  console.log(`🌐 Visiting: https://circuitbreaker.online`)
  await page.goto('https://circuitbreaker.online', { waitUntil: 'networkidle', timeout: 30000 })
  
  // Wait to see if anything fires natively
  await new Promise(r => setTimeout(r, 5000))
  
  // Check if dataLayer exists
  const dl = await page.evaluate(() => {
    // @ts-ignore
    return window.dataLayer
  })
  console.log('[dataLayer]:', JSON.stringify(dl, null, 2))

  await browser.close()
  console.log('✅ Debug complete')
}

debugGA()
