import crypto from 'node:crypto'
import {
  createDopplerConfig,
  createDopplerProject,
  syncCopilotConfig,
  syncHubSecrets,
  syncDevConfig,
  createDopplerServiceToken,
} from '../../apps/web/server/utils/provision-doppler'
import { buildLocalNuxtUrl, normalizeNuxtPort } from '../../apps/web/server/utils/nuxt-port'
import { appendGitHubEnv } from './github-actions-env'

async function main() {
  const APP_NAME = process.argv.find((a) => a.startsWith('--app-name='))?.split('=')[1]
  const APP_URL = process.argv.find((a) => a.startsWith('--app-url='))?.split('=')[1]
  const DISPLAY_NAME = process.argv.find((a) => a.startsWith('--display-name='))?.split('=')[1]
  const nuxtFromArg = process.argv.find((a) => a.startsWith('--nuxt-port='))?.split('=')[1]
  const resolvedNuxtPort = normalizeNuxtPort(nuxtFromArg ?? process.env.NUXT_PORT)
  const provisionId = process.argv.find((a) => a.startsWith('--provision-id='))?.split('=')[1]

  if (!APP_NAME || !APP_URL || !DISPLAY_NAME) {
    throw new Error('--app-name, --app-url, and --display-name are required')
  }
  if (resolvedNuxtPort === null) {
    throw new Error('--nuxt-port or NUXT_PORT is required and must be a valid TCP port')
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
  const packageRegistryProvider =
    process.env.PACKAGE_REGISTRY_PROVIDER === 'forgejo' ? 'forgejo' : 'github'
  const forgejoBaseUrl = process.env.FLEET_FORGEJO_BASE_URL || 'https://code.nard.uk'
  const forgejoOwner = process.env.FLEET_FORGEJO_OWNER || 'narduk-enterprises'
  const forgejoToken = process.env.FORGEJO_TOKEN || ''
  const ghPackagesToken =
    process.env.GH_PACKAGES_TOKEN ||
    process.env.GITHUB_PACKAGES_TOKEN ||
    process.env.GITHUB_TOKEN_PACKAGES_READ
  const nodeAuthToken =
    process.env.NODE_AUTH_TOKEN ||
    (packageRegistryProvider === 'forgejo' ? forgejoToken : ghPackagesToken) ||
    forgejoToken ||
    ghPackagesToken
  const sharedRegistryConfig = {
    PACKAGE_REGISTRY_PROVIDER: packageRegistryProvider,
    FLEET_FORGEJO_BASE_URL: forgejoBaseUrl,
    FLEET_FORGEJO_OWNER: forgejoOwner,
  }
  const optionalForgejoSecrets = forgejoToken ? { FORGEJO_TOKEN: forgejoToken } : {}

  console.log(`Syncing secrets...`)

  // Sync hub secrets (prd)
  await syncHubSecrets(apiToken, 'narduk-nuxt-template', 'prd', APP_NAME, 'prd', {
    APP_NAME,
    SITE_URL: APP_URL,
    CRON_SECRET: cronSecret,
    NUXT_SESSION_PASSWORD: sessionPassword,
    ...sharedRegistryConfig,
    ...optionalForgejoSecrets,
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
      NUXT_PORT: String(resolvedNuxtPort),
      ...sharedRegistryConfig,
      ...optionalForgejoSecrets,
    },
    { siteUrl: buildLocalNuxtUrl(resolvedNuxtPort) },
  )

  const copilotSecrets = {
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || '',
    PACKAGE_REGISTRY_PROVIDER: packageRegistryProvider,
    FLEET_FORGEJO_BASE_URL: forgejoBaseUrl,
    FLEET_FORGEJO_OWNER: forgejoOwner,
    GITHUB_TOKEN_PACKAGES_READ: ghPackagesToken || '',
    FORGEJO_TOKEN: forgejoToken,
    NODE_AUTH_TOKEN: nodeAuthToken || '',
  }
  const nonEmptyCopilotSecrets = Object.fromEntries(
    Object.entries(copilotSecrets).filter(([, value]) => Boolean(value.trim())),
  )
  const hasRequiredAgentSecret = Boolean(
    (copilotSecrets.CLOUDFLARE_ACCOUNT_ID || '').trim() ||
    (copilotSecrets.CLOUDFLARE_API_TOKEN || '').trim() ||
    (copilotSecrets.GITHUB_TOKEN_PACKAGES_READ || '').trim() ||
    (copilotSecrets.FORGEJO_TOKEN || '').trim() ||
    (copilotSecrets.NODE_AUTH_TOKEN || '').trim(),
  )

  if (!hasRequiredAgentSecret) {
    throw new Error(
      'Cannot seed prd_copilot. Expected at least one package token or Cloudflare credential in the runner environment.',
    )
  }

  console.log(`Ensuring prd_copilot exists...`)
  await createDopplerConfig(apiToken, APP_NAME, 'prd_copilot', 'prd')

  console.log(`Syncing prd_copilot inheritance + minimal agent-only secrets...`)
  await syncCopilotConfig(
    apiToken,
    'narduk-nuxt-template',
    'prd',
    APP_NAME,
    'prd_copilot',
    nonEmptyCopilotSecrets,
  )

  console.log(`Generating CI service token...`)
  const dopplerToken = await createDopplerServiceToken(apiToken, APP_NAME, 'prd', 'ci-deploy')
  console.log(`Generating Copilot sync service token...`)
  const copilotDopplerToken = await createDopplerServiceToken(
    apiToken,
    APP_NAME,
    'prd_copilot',
    'copilot-sync',
  )
  console.log(`✅ Doppler project ready. Service tokens created.`)

  if (process.env.GITHUB_ENV) {
    appendGitHubEnv('APP_DOPPLER_TOKEN', dopplerToken)
    appendGitHubEnv('APP_DOPPLER_COPILOT_TOKEN', copilotDopplerToken)
  }
}

main().catch((err) => {
  console.error('❌ Doppler Provisioning failed:', err)
  process.exit(1)
})
