import { googleApiFetch } from '../layers/narduk-nuxt-layer/server/utils/google'
import { $fetch } from 'ofetch'

const CONTROL_PLANE_URL = process.env.CONTROL_PLANE_URL || 'https://control-plane.nard.uk'
interface FleetApp { name: string; url: string; dopplerProject: string }

// Mock runtime config for googleApiFetch
globalThis.useRuntimeConfig = () => ({
  googleServiceAccountKey: process.env.GSC_SERVICE_ACCOUNT_JSON || ''
})

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN
if (!CF_TOKEN) throw new Error('Missing CLOUDFLARE_API_TOKEN')

const CF_DNS_TOKEN = process.env.CLOUDFLARE_DNS_TOKEN || CF_TOKEN

const siteVerificationUrl = 'https://www.googleapis.com/siteVerification/v1/webResource'
const SCOPES = ['https://www.googleapis.com/auth/siteverification']

// Helper to find CF Zone ID by incrementally shortening the hostname
async function findZoneId(hostname: string): Promise<string | null> {
  let parts = hostname.split('.')
  while (parts.length >= 2) {
    const domain = parts.join('.')
    const data = await $fetch<any>(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, {
      headers: { Authorization: `Bearer ${CF_DNS_TOKEN}` }
    })
    if (data.result && data.result.length > 0) return data.result[0].id
    parts.shift()
  }
  return null
}

async function verifyDomain(hostname: string) {
  console.log(`\n--- Verifying sc-domain:${hostname} ---`)

  try {
    // 1. Check if already verified
    const getRes = await googleApiFetch(`${siteVerificationUrl}/${encodeURIComponent('sc-domain:' + hostname)}`, SCOPES)
      .catch(() => null)
    if (getRes?.id) {
       console.log(`✅ Already verified: ${getRes.id}`)
       return
    }

    // 2. Get DNS TXT Token
    console.log('Fetching DNS token...')
    const tokenRes = await googleApiFetch('https://www.googleapis.com/siteVerification/v1/token', SCOPES, {
      method: 'POST',
      body: JSON.stringify({
        verificationMethod: 'DNS_TXT',
        site: { identifier: hostname, type: 'INET_DOMAIN' }
      })
    })

    const token = tokenRes.token
    if (!token) throw new Error('No token returned')
    console.log(`Token received: ${token}`)

    // 3. Find Cloudflare Zone
    const zoneId = await findZoneId(hostname)
    if (!zoneId) throw new Error(`Could not find Cloudflare zone for ${hostname}`)
    console.log(`Found Cloudflare Zone ID: ${zoneId}`)

    // 4. Check if TXT record already exists to avoid duplicates
    const records = await $fetch<any>(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=TXT&name=${hostname}`, {
      headers: { Authorization: `Bearer ${CF_DNS_TOKEN}` }
    })
    let recordExists = false
    for (const r of records.result) {
      if (r.content === token) recordExists = true
    }

    if (!recordExists) {
      console.log('Pushing TXT record to Cloudflare DNS...')
      await $fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${CF_DNS_TOKEN}` },
        body: { type: 'TXT', name: hostname, content: token, ttl: 120 }
      })
      
      console.log('Waiting 10 seconds for DNS propagation...')
      await new Promise(r => setTimeout(r, 10000))
    } else {
      console.log('TXT record already exists in Cloudflare.')
    }

    // 5. Verify the resource
    console.log('Requesting Google ownership verification...')
    await googleApiFetch(`${siteVerificationUrl}?verificationMethod=DNS_TXT`, SCOPES, {
      method: 'POST',
      body: JSON.stringify({
        site: { identifier: hostname, type: 'INET_DOMAIN' }
      })
    })

    console.log(`🎉 Successfully verified sc-domain:${hostname}!`)

  } catch (err: any) {
    console.error(`❌ Failed to verify ${hostname}: ${err.message || err.statusText}`)
    if (err.body) console.error(err.body)
  }
}

async function main() {
  let apps: FleetApp[]
  try {
    const res = await fetch(`${CONTROL_PLANE_URL}/api/fleet/apps`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    apps = await res.json() as FleetApp[]
  } catch {
    console.error(`❌ Could not fetch fleet apps from ${CONTROL_PLANE_URL}/api/fleet/apps`)
    process.exit(1)
  }
  for (const app of apps) {
    const hostname = new URL(app.url).hostname
    await verifyDomain(hostname)
  }
}

main()
