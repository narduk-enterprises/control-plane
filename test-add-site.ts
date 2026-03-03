import { SignJWT, importPKCS8 } from 'jose'

async function tryVerify() {
    const saKeyJson = process.env.GSC_SERVICE_ACCOUNT_JSON
    if (!saKeyJson) throw new Error('No GSC_SERVICE_ACCOUNT_JSON')
    const decoded = saKeyJson.trim().startsWith('{') ? saKeyJson : atob(saKeyJson)
    const sa = JSON.parse(decoded)
    const privateKey = await importPKCS8(sa.private_key, 'RS256')

    const now = Math.floor(Date.now() / 1000)
    const jwt = await new SignJWT({
        iss: sa.client_email,
        sub: sa.client_email,
        scope: 'https://www.googleapis.com/auth/webmasters',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
    })
        .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
        .sign(privateKey)

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }),
    })
    if (!tokenResponse.ok) { console.error('Token failed', await tokenResponse.text()); return }
    const tokenData = await tokenResponse.json()
    const token = tokenData.access_token

    const siteUrl = 'sc-domain:neon-sewer-raid.nard.uk'
    console.log('Adding site:', siteUrl)
    const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!res.ok) console.error('Failed to add site:', res.status, await res.text())
    else { console.log('Successfully added site!'); console.log(await res.text() || 'no body') }
}

tryVerify()
