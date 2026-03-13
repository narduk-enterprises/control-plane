import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Grant GSC Access Script
 *
 * Usage:
 * doppler run -p control-plane -c prd -- npx tsx tools/grant-gsc-access.ts <site_url>
 *
 * Example:
 * doppler run -p control-plane -c prd -- npx tsx tools/grant-gsc-access.ts https://neon-sewer-raid.nard.uk
 */

function env(key: string): string {
  return (process.env[key] || '').trim()
}

function loadCredentials(): Record<string, any> {
  const keyFilePath = env('GSC_SERVICE_ACCOUNT_JSON_PATH')
  if (keyFilePath) {
    const resolved = resolve(process.cwd(), keyFilePath)
    if (!existsSync(resolved)) {
      throw new Error(`Service account key file not found: ${resolved}`)
    }
    return JSON.parse(readFileSync(resolved, 'utf8'))
  }

  const inline = env('GSC_SERVICE_ACCOUNT_JSON')
  if (inline) {
    let str = inline
    if (!str.startsWith('{')) {
      str = Buffer.from(str, 'base64').toString('utf8')
    }
    return JSON.parse(str)
  }

  throw new Error('No service account credentials found. Set GSC_SERVICE_ACCOUNT_JSON in Doppler.')
}

function getServiceAccountEmail(creds: Record<string, any>): string {
  return creds?.client_email
}

async function main() {
  const siteUrlArg = process.argv[2]
  if (!siteUrlArg) {
    console.error('❌ Missing site URL argument.')
    console.error(
      'Usage: doppler run -p control-plane -c prd -- npx tsx tools/grant-gsc-access.ts <site_url>',
    )
    process.exit(1)
  }

  // Ensure no trailing slash for the identifier
  const siteUrl = siteUrlArg.replace(/\/$/, '')

  const userEmail = env('GSC_USER_EMAIL')

  let creds: Record<string, any>
  try {
    creds = loadCredentials()
  } catch (err: any) {
    console.error(`❌ ${err.message}`)
    process.exit(1)
  }

  const serviceAccountEmail = getServiceAccountEmail(creds)
  if (!serviceAccountEmail) {
    console.error('❌ Service account email not found in the credentials JSON.')
    process.exit(1)
  }

  // @ts-expect-error googleapis is used as a dev dependency
  const { google } = await import('googleapis')

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: [
      'https://www.googleapis.com/auth/webmasters',
      'https://www.googleapis.com/auth/siteverification',
    ],
  })

  const siteVerification = google.siteVerification({ version: 'v1', auth })

  console.log(`\n🔍 Checking access for ${siteUrl}...`)

  try {
    // We are trying to add the service account email as an owner.
    // However, the *request* needs to be authenticated by someone who is ALREADY an owner.
    // If the service account is executing this, it can only add *others* if it is an owner.
    // But in this case, the user wants the personal user (who is already an owner) to add the SA.
    // Wait, if the script runs with the SA credentials, it will fail if it's not already an owner.
    //
    // Wait, the standard setup flow in `setup-analytics.ts` uses the SA to *verify* the site
    // (making the SA an owner automatically), and then the SA grants access to the human user.
    //
    // If the human user manually verified the site but the SA isn't an owner, the SA *cannot*
    // grant itself access. Verification must be done via the API by the SA first if it's not an owner.

    // Let's have the SA verify ownership of the site via the API. This requires the verification
    // file or meta tag to be present on the live site already.
    console.log(`\n🔑 Requesting the SA (${serviceAccountEmail}) to verify ownership...`)

    await siteVerification.webResource.insert({
      verificationMethod: 'FILE', // or META, we'll try FILE as it's standard for narduk
      requestBody: {
        site: { identifier: siteUrl, type: 'SITE' },
      },
    })
    console.log(`✅ Ownership verified for ${serviceAccountEmail}!`)

    // Once verified, the SA is an owner. Now ensure the human user is also an owner.
    if (userEmail) {
      console.log(`\n👤 Ensuring human user (${userEmail}) is also an owner...`)
      const resource = await siteVerification.webResource.get({
        id: siteUrl,
      })

      const owners = resource.data.owners || []
      if (!owners.includes(userEmail)) {
        owners.push(userEmail)
        await siteVerification.webResource.update({
          id: siteUrl,
          requestBody: {
            site: { identifier: siteUrl, type: 'SITE' },
            owners,
          },
        })
        console.log(`✅ ${userEmail} added as an owner.`)
      } else {
        console.log(`⏭ ${userEmail} is already an owner.`)
      }
    }

    console.log('\n🎉 Successfully granted Service Account access to the GSC property!')
  } catch (e: any) {
    const status = e.response?.status
    const message = e.message || String(e)

    if (
      message.includes('not verified') ||
      status === 400 ||
      message.includes("We couldn't find your verification file")
    ) {
      console.error(`\n❌ Failed to verify ownership automatically.`)
      console.error(
        `This usually means the verification file (e.g., googleXXXX.html) is not deployed to the live site at ${siteUrl}.`,
      )
      console.error(
        `To fix this: Run 'npx jiti tools/setup-analytics.ts gsc' inside the app's repo, deploy it, and try this script again.`,
      )
      console.error(`\nRaw error: ${message}`)
    } else if (status === 403) {
      console.error(`\n❌ 403 Forbidden.`)
      console.error(
        `The service account does not have permission to access the Webmaster API or the property isn't verified.`,
      )
      console.error(`Raw error: ${message}`)
    } else {
      console.error(`\n❌ An error occurred: ${message}`)
    }
  }
}

main().catch(console.error)
