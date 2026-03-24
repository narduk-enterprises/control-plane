import crypto from 'node:crypto'
import {
  createDopplerProject,
  syncHubSecrets,
  syncDevConfig,
  createDopplerServiceToken,
} from '../../apps/web/server/utils/provision-doppler'
import { appendGitHubEnv } from './github-actions-env'

async function main() {
  const APP_NAME = process.argv.find((a) => a.startsWith('--app-name='))?.split('=')[1]
  const APP_URL = process.argv.find((a) => a.startsWith('--app-url='))?.split('=')[1]
  const DISPLAY_NAME = process.argv.find((a) => a.startsWith('--display-name='))?.split('=')[1]
  const nuxtFromArg = process.argv.find((a) => a.startsWith('--nuxt-port='))?.split('=')[1]
  const NUXT_PORT = (nuxtFromArg ?? process.env.NUXT_PORT)?.trim() || '3000'
  const provisionId = process.argv.find((a) => a.startsWith('--provision-id='))?.split('=')[1]

  if (!APP_NAME || !APP_URL || !DISPLAY_NAME) {
    throw new Error('--app-name, --app-url, and --display-name are required')
  }

  if (provisionId) {
    console.log(`Provision job: ${provisionId}`)
  }

  const apiToken = process.env.DOPPLER_API_TOKEN || process.env.DOPPLER_TOKEN
  if (!apiToken) {
    throw new Error('DOPPLER_API_TOKEN or DOPPLER_TOKEN is required in environment')
  }

  console.log(`Provisioning Doppler project: ${APP_NAME}`)

  await createDopplerProject(
    apiToken,
    APP_NAME,
    `${DISPLAY_NAME} — auto-provisioned by Control Plane`,
  )

  const cronSecret = crypto.randomBytes(16).toString('hex')
  const sessionPassword = crypto.randomBytes(32).toString('hex')

  console.log(`Syncing secrets...`)

  // Sync hub secrets (prd)
  await syncHubSecrets(apiToken, 'narduk-nuxt-template', 'prd', APP_NAME, 'prd', {
    APP_NAME,
    SITE_URL: APP_URL,
    CRON_SECRET: cronSecret,
    NUXT_SESSION_PASSWORD: sessionPassword,
  })

  // Sync dev config
  await syncDevConfig(
    apiToken,
    'narduk-nuxt-template',
    'prd',
    APP_NAME,
    {
      APP_NAME,
      CRON_SECRET: cronSecret,
      NUXT_SESSION_PASSWORD: sessionPassword,
      NUXT_PORT,
    },
    { siteUrl: `http://localhost:${NUXT_PORT}` },
  )

  console.log(`Generating CI service token...`)
  const dopplerToken = await createDopplerServiceToken(apiToken, APP_NAME, 'prd', 'ci-deploy')
  console.log(`✅ Doppler project ready. Service token created.`)

  if (process.env.GITHUB_ENV) {
    appendGitHubEnv('APP_DOPPLER_TOKEN', dopplerToken)
  }
}

main().catch((err) => {
  console.error('❌ Doppler Provisioning failed:', err)
  process.exit(1)
})
