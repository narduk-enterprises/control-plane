import {
  parseServiceAccountJson,
  getGoogleAccessToken,
  createGA4Property,
  createGA4DataStream,
  registerGscSite,
  getGscVerificationToken,
  generateIndexNowKey,
} from '../../apps/web/server/utils/provision-analytics'

import { bulkSetSecrets, getDopplerSecrets } from '../../apps/web/server/utils/provision-doppler'
import { appendGitHubEnv } from './github-actions-env'

async function main() {
  const APP_NAME = process.argv.find((a) => a.startsWith('--app-name='))?.split('=')[1]
  const APP_URL = process.argv.find((a) => a.startsWith('--app-url='))?.split('=')[1]

  if (!APP_NAME || !APP_URL) {
    throw new Error('--app-name and --app-url are required')
  }

  let gaPropertyId = process.env.GA_PROPERTY_ID?.trim() || ''
  let gaMeasurementId = process.env.GA_MEASUREMENT_ID?.trim() || ''
  let gscVerificationFileName = process.env.GSC_VERIFICATION_FILE?.trim() || ''
  let gscVerificationContent = process.env.GSC_VERIFICATION_CONTENT || ''
  let indexNowKey = process.env.INDEXNOW_KEY?.trim() || ''

  console.log(`Provisioning Analytics for ${APP_NAME} (${APP_URL})`)

  try {
    const dopplerToken = process.env.DOPPLER_API_TOKEN || process.env.DOPPLER_TOKEN
    if (dopplerToken) {
      try {
        console.log('Checking for existing analytics secrets in Doppler...')
        const existingSecrets = await getDopplerSecrets(dopplerToken, APP_NAME, 'prd')
        gaPropertyId ||= existingSecrets.GA_PROPERTY_ID?.trim() || ''
        gaMeasurementId ||= existingSecrets.GA_MEASUREMENT_ID?.trim() || ''
        indexNowKey ||= existingSecrets.INDEXNOW_KEY?.trim() || ''
      } catch {
        // Fresh project or token lacks read access to current config.
      }
    }

    const serviceAccountJson = process.env.GSC_SERVICE_ACCOUNT_JSON
    const gaAccountId = process.env.GA_ACCOUNT_ID

    const credentials = serviceAccountJson ? parseServiceAccountJson(serviceAccountJson) : null

    if (gaPropertyId && gaMeasurementId) {
      console.log(
        `Reusing existing GA4 property ${gaPropertyId} and measurement ID ${gaMeasurementId}.`,
      )
    } else if (credentials && gaAccountId) {
      console.log('Fetching Google Access Token...')
      const gaAccessToken = await getGoogleAccessToken(credentials, [
        'https://www.googleapis.com/auth/analytics.edit',
      ])

      console.log('Creating GA4 Property...')
      const property = await createGA4Property(gaAccessToken, gaAccountId, APP_NAME, APP_URL)
      gaPropertyId = property.propertyId

      console.log(`Created GA4 Property: ${gaPropertyId}`)

      console.log('Creating GA4 Data Stream...')
      const stream = await createGA4DataStream(
        gaAccessToken,
        property.propertyName,
        APP_NAME,
        APP_URL,
      )
      gaMeasurementId = stream.measurementId
      console.log(`Created GA4 Data Stream: ${gaMeasurementId}`)
    } else {
      console.log(
        '⚠️ Skipping Google Analytics (missing GSC_SERVICE_ACCOUNT_JSON or GA_ACCOUNT_ID)',
      )
    }

    if (credentials) {
      console.log('Fetching GSC Access Token...')
      const gscAccessToken = await getGoogleAccessToken(credentials, [
        'https://www.googleapis.com/auth/webmasters',
        'https://www.googleapis.com/auth/siteverification',
      ])

      console.log('Registering GSC Site...')
      await registerGscSite(gscAccessToken, APP_URL)

      if (!gscVerificationFileName || !gscVerificationContent) {
        console.log('Fetching GSC Verification Token...')
        const verification = await getGscVerificationToken(gscAccessToken, APP_URL)
        gscVerificationFileName = verification.fileName
        gscVerificationContent = verification.fileContent
        console.log(`GSC Verification Token: ${gscVerificationFileName}`)
      } else {
        console.log(`Reusing existing GSC verification file: ${gscVerificationFileName}`)
      }
    } else {
      console.log('⚠️ Skipping Google Search Console (missing GSC_SERVICE_ACCOUNT_JSON)')
    }

    if (!indexNowKey) {
      indexNowKey = generateIndexNowKey()
      console.log(`Generated new IndexNow Key: ${indexNowKey}`)
    }

    // Write analytics IDs back to Doppler
    if (dopplerToken && (gaPropertyId || indexNowKey)) {
      const analyticsSecrets: Record<string, string> = {}
      if (gaPropertyId) analyticsSecrets.GA_PROPERTY_ID = gaPropertyId
      if (gaMeasurementId) analyticsSecrets.GA_MEASUREMENT_ID = gaMeasurementId
      if (indexNowKey) analyticsSecrets.INDEXNOW_KEY = indexNowKey

      console.log('Writing Analytics secrets back to Doppler PRD and DEV environments...')
      await bulkSetSecrets(dopplerToken, APP_NAME, 'prd', analyticsSecrets)
      await bulkSetSecrets(dopplerToken, APP_NAME, 'dev', analyticsSecrets)
    }

    if (process.env.GITHUB_ENV) {
      if (gaPropertyId) appendGitHubEnv('GA_PROPERTY_ID', gaPropertyId)
      if (gaMeasurementId) appendGitHubEnv('GA_MEASUREMENT_ID', gaMeasurementId)
      if (gscVerificationFileName) {
        appendGitHubEnv('GSC_VERIFICATION_FILE', gscVerificationFileName)
        appendGitHubEnv('GSC_VERIFICATION_CONTENT', gscVerificationContent)
      }
      if (indexNowKey) appendGitHubEnv('INDEXNOW_KEY', indexNowKey)
    }

    console.log(`✅ Analytics provisioning complete.`)
  } catch (err: unknown) {
    // Analytics failures are non-fatal — log but continue
    const error = err as { message?: string }
    console.warn(`⚠️ Analytics provisioning warning: ${error.message}`)
    // Do not exit with 1, as this step is non-fatal.
  }
}

main().catch((err) => {
  console.error('❌ Analytics Provisioning failed:', err)
  // Non-fatal
  process.exit(0)
})
