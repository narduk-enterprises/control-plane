import { firefox } from 'playwright'

async function check() {
  const browser = await firefox.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0'
  })
  const page = await context.newPage()

  page.on('request', req => {
    const url = req.url()
    if (url.includes('us.i.posthog.com') || url.includes('/e/')) {
        let payload = null
        if (req.method() === 'POST') {
          try {
            payload = req.postDataJSON()
            console.log(`\n--- POSTHOG POST REQUEST FOUND! ---`)
            console.log(JSON.stringify(payload, null, 2))
          } catch(e) { }
        } else if (req.method() === 'GET') {
          const defaultUrl = new URL(url)
          const data = defaultUrl.searchParams.get('data')
          if (data) {
            try {
              payload = JSON.parse(Buffer.from(data, 'base64').toString('utf8'))
              console.log(`\n--- POSTHOG GET REQUEST FOUND! ---`)
              console.log(JSON.stringify(payload, null, 2))
            } catch(e) { }
          }
        }
    }
  })

  // austin-texas.net might have some weirdness, so we'll test dictionary.nard.uk which previously reported missing app property
  console.log('Visiting http://localhost:3002')
  await page.goto('http://localhost:3002', { waitUntil: 'networkidle' })
  await new Promise(r => setTimeout(r, 6000))

  await browser.close()
  console.log('Done.')
}

check()
