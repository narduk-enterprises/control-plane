/**
 * Batch GA4 property creation for fleet apps missing property IDs.
 *
 * Usage: doppler run --project narduk-nuxt-template --config prd -- npx jiti tools/batch-ga-setup.ts
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function env(key: string): string {
  return (process.env[key] || '').trim()
}

function loadCredentials(): Record<string, any> {
  const keyFilePath = env('GSC_SERVICE_ACCOUNT_JSON_PATH')
  if (keyFilePath) {
    const resolved = resolve(process.cwd(), keyFilePath)
    if (!existsSync(resolved)) throw new Error(`Key file not found: ${resolved}`)
    return JSON.parse(readFileSync(resolved, 'utf8'))
  }
  const inline = env('GSC_SERVICE_ACCOUNT_JSON')
  if (inline) {
    let str = inline
    if (!str.startsWith('{')) str = Buffer.from(str, 'base64').toString('utf8')
    return JSON.parse(str)
  }
  throw new Error(
    'No service account credentials. Set GSC_SERVICE_ACCOUNT_JSON_PATH or GSC_SERVICE_ACCOUNT_JSON.',
  )
}

async function main() {
  // @ts-expect-error dynamic import
  const { google } = await import('googleapis')

  const gaAccountId = env('GA_ACCOUNT_ID')
  if (!gaAccountId) throw new Error('GA_ACCOUNT_ID not set')

  const credentials = loadCredentials()
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/analytics.edit'],
  })

  const analyticsadmin = google.analyticsadmin({ version: 'v1beta', auth })

  console.log(`Listing all GA4 properties for account ${gaAccountId}...\n`)
  const listRes = await analyticsadmin.properties.list({
    filter: `parent:accounts/${gaAccountId}`,
    pageSize: 200,
  })

  const properties = listRes.data.properties || []
  console.log(`Found ${properties.length} properties:\n`)

  for (const p of properties) {
    const id = p.name?.replace('properties/', '') || '?'
    console.log(`  ${id}  ${p.displayName}`)
  }

  // Apps that need properties
  const missingApps = [
    { name: 'ai-media-gen', url: 'https://ai-media-gen.nard.uk' },
    { name: 'favicon-checker', url: 'https://favicon-checker.nard.uk' },
    { name: 'control-plane', url: 'https://control-plane.nard.uk' },
    { name: 'tide-check', url: 'https://tide-check.nard.uk' },
  ]

  console.log('\n--- Creating missing properties ---\n')

  for (const app of missingApps) {
    const existing = properties.find((p: any) => p.displayName === app.name)
    if (existing) {
      const id = existing.name?.replace('properties/', '') || '?'
      console.log(`✅ ${app.name}: already exists → ${id}`)
      continue
    }

    const propertyRes = await analyticsadmin.properties.create({
      requestBody: {
        parent: `accounts/${gaAccountId}`,
        displayName: app.name,
        timeZone: 'America/Chicago',
        currencyCode: 'USD',
      },
    })

    const propertyName = propertyRes.data?.name || ''
    const propertyId = propertyName.replace('properties/', '')
    console.log(`✅ ${app.name}: created → ${propertyId}`)

    const streamRes = await analyticsadmin.properties.dataStreams.create({
      parent: propertyName,
      requestBody: {
        displayName: `${app.name} Web`,
        type: 'WEB_DATA_STREAM',
        webStreamData: { defaultUri: app.url },
      },
    })

    const measurementId = (streamRes.data as any)?.webStreamData?.measurementId || '?'
    console.log(`   Stream: ${measurementId}`)
  }
}

main().catch((e) => {
  console.error('Error:', e.message)
  process.exit(1)
})
