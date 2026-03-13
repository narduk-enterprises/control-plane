import { firefox } from 'playwright'

async function checkSingle() {
  const browser = await firefox.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0',
  })
  const page = await context.newPage()

  let phRequestFound = false
  let posthogAppProperty = null

  page.on('console', (msg) => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`))
  page.on('pageerror', (err) => console.log(`[Browser Error] ${err.message}`))
  page.on('requestfailed', (request) =>
    console.log(`[Request Failed] ${request.url()} - ${request.failure()?.errorText}`),
  )

  page.on('request', (req) => {
    const url = req.url()
    if (req.method() === 'POST') {
      console.log(`[POST] ${url}`)
    }

    if (url.includes('posthog') || url.includes('/e/')) {
      phRequestFound = true
      let payload = null

      if (req.method() === 'POST') {
        try {
          payload = req.postDataJSON()
          console.log('\n[RAW POSTHOG PAYLOAD INTERCEPTED]', JSON.stringify(payload, null, 2))
        } catch (e) {}
      } else if (req.method() === 'GET') {
        const defaultUrl = new URL(url)
        const data = defaultUrl.searchParams.get('data')
        if (data) {
          try {
            payload = JSON.parse(Buffer.from(data, 'base64').toString('utf8'))
            console.log('\n[RAW POSTHOG GET PAYLOAD INTERCEPTED]', JSON.stringify(payload, null, 2))
          } catch (e) {}
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

  console.log(`🌐 Visiting: https://austin-texas.net`)
  await page.goto('https://austin-texas.net', { waitUntil: 'networkidle', timeout: 30000 })

  const nuxtConfig = await page.evaluate(() => {
    return (window as any).__NUXT__ || {}
  })
  // console.log('__NUXT__:', JSON.stringify(nuxtConfig, null, 2))

  const evalResult = await page.evaluate(async () => {
    console.log('Manually calling posthog.capture')
    if ((window as any).posthog) {
      ;(window as any).posthog.capture('playwright_test')
      return {
        found: true,
        appProperty: (window as any).posthog.get_property('app'),
      }
    } else {
      console.log('window.posthog is missing natively on the page')
      return { found: false, appProperty: null }
    }
  })

  if (evalResult.found) {
    if (evalResult.appProperty) {
      console.log(`✅ SUCCESS - In-browser PostHog app property: ${evalResult.appProperty}`)
    } else {
      console.log(`❌ FAILED - In-browser PostHog app property is null/missing!`)
    }
  } else {
    console.log(`❌ FAILED - window.posthog is completely missing!`)
  }

  await new Promise((r) => setTimeout(r, 6000))

  if (phRequestFound) {
    if (posthogAppProperty) {
      console.log(`✅ SUCCESS - Network payload PostHog app property: ${posthogAppProperty}`)
    } else {
      console.log(`❌ FAILED - Network payload PostHog app property is null/missing!`)
    }
  } else {
    console.log(`❌ FAILED - No PostHog network requests intercepted!`)
  }

  await browser.close()
}

checkSingle()
