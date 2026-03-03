import { SignJWT, importPKCS8 } from 'jose'

async function getAccessToken(sa: any, scopes: string[]) {
    const privateKey = await importPKCS8(sa.private_key, 'RS256')
    const now = Math.floor(Date.now() / 1000)
    const jwt = await new SignJWT({
        iss: sa.client_email,
        sub: sa.client_email,
        scope: scopes.join(' '),
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
    }).setProtectedHeader({ alg: 'RS256', typ: 'JWT' }).sign(privateKey)

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    })
    const data = await res.json()
    return data.access_token
}

async function testAutomatedVerification() {
    const saKeyJson = process.env.GSC_SERVICE_ACCOUNT_JSON
    if (!saKeyJson) throw new Error('No GSC_SERVICE_ACCOUNT_JSON')
    const sa = JSON.parse(saKeyJson.trim().startsWith('{') ? saKeyJson : atob(saKeyJson))

    const token = await getAccessToken(sa, ['https://www.googleapis.com/auth/siteverification', 'https://www.googleapis.com/auth/webmasters'])
    console.log('Got Google token')

    const domain = 'neon-sewer-raid.nard.uk'

    // 1. Get Token from Site Verification API
    const tokenRes = await fetch('https://www.googleapis.com/siteVerification/v1/token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            verificationMethod: 'DNS_TXT',
            site: { identifier: domain, type: 'INET_DOMAIN' }
        })
    })
    if (!tokenRes.ok) { console.error('Token fetch failed', await tokenRes.text()); return }
    const tokenData = await tokenRes.json()
    console.log('DNS TXT Record to add:', tokenData.token)

    // 2. Add to Cloudflare
    const cfToken = process.env.CLOUDFLARE_API_TOKEN
    if (!cfToken) throw new Error('No CLOUDFLARE_API_TOKEN')

    // Get Zone ID for nard.uk
    const reqZone = await fetch(`https://api.cloudflare.com/client/v4/zones?name=nard.uk`, {
        headers: { Authorization: `Bearer ${cfToken}` }
    })
    const zoneData = await reqZone.json()
    const zoneId = zoneData.result[0].id
    console.log('Zone ID:', zoneId)

    // 3. Insert TXT record
    const dnsRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'TXT',
            name: domain,
            content: tokenData.token,
            ttl: 120,
            comment: 'GSC Verification'
        })
    })
    const dnsData = await dnsRes.json()
    if (!dnsData.success) {
        if (dnsData.errors?.[0]?.code === 81057) {
            console.log('Record already exists!')
        } else {
            console.error('DNS add failed', dnsData)
            return
        }
    } else {
        console.log('DNS Record added!')
    }

    // 4. Verify in Google
    console.log('Waiting 5s for DNS propagation...')
    await new Promise(r => setTimeout(r, 5000))

    const verifyRes = await fetch('https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=DNS_TXT', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            site: { identifier: domain, type: 'INET_DOMAIN' }
        })
    })
    if (!verifyRes.ok) { console.error('Verify failed', await verifyRes.text()); return }
    console.log('Google Verified!', await verifyRes.json())

    // 5. Add to Webmasters as well
    const scDomain = `sc-domain:${domain}`
    const addRes = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(scDomain)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
    })
    if (!addRes.ok) { console.error('Add failed', await addRes.text()); return }
    console.log('Added to search console!', await addRes.text() || 'Success')
}

testAutomatedVerification()
