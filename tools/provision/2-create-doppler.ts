import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  bulkSetSecrets,
  createDopplerProject,
  syncHubSecrets,
  syncDevConfig,
  createDopplerServiceToken,
} from '../../apps/web/server/utils/provision-doppler'
import { buildLocalNuxtUrl, normalizeNuxtPort } from '../../apps/web/server/utils/nuxt-port'
import { appendGitHubEnv } from './github-actions-env'

function ensureDopplerBranchConfig(
  apiToken: string,
  project: string,
  config: string,
  environment: string,
): void {
  const result = spawnSync(
    'doppler',
    [
      'configs',
      'create',
      config,
      '--project',
      project,
      '--environment',
      environment,
      '--token',
      apiToken,
    ],
    {
      encoding: 'utf-8',
    },
  )

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
  if (result.status === 0 || /already exists/i.test(output)) {
    return
  }

  if (result.error) {
    throw result.error
  }

  throw new Error(
    `Failed to ensure Doppler config ${project}/${config}: ${output || `exit ${result.status ?? 'unknown'}`}`,
  )
}

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
  const ghPackagesToken =
    process.env.GH_PACKAGES_TOKEN ||
    process.env.GITHUB_PACKAGES_TOKEN ||
    process.env.GITHUB_TOKEN_PACKAGES_READ
  const nodeAuthToken = process.env.NODE_AUTH_TOKEN || ghPackagesToken

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
      NUXT_PORT: String(resolvedNuxtPort),
    },
    { siteUrl: buildLocalNuxtUrl(resolvedNuxtPort) },
  )

  const copilotSecrets = {
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || '',
    GITHUB_TOKEN_PACKAGES_READ: ghPackagesToken || '',
    NODE_AUTH_TOKEN: nodeAuthToken || '',
  }
  const nonEmptyCopilotSecrets = Object.fromEntries(
    Object.entries(copilotSecrets).filter(([, value]) => Boolean(value.trim())),
  )

  if (Object.keys(nonEmptyCopilotSecrets).length === 0) {
    throw new Error(
      'Cannot seed prd_copilot. Expected at least one of CLOUDFLARE_*, GITHUB_TOKEN_PACKAGES_READ, or NODE_AUTH_TOKEN in the runner environment.',
    )
  }

  console.log(`Ensuring prd_copilot exists...`)
  ensureDopplerBranchConfig(apiToken, APP_NAME, 'prd_copilot', 'prd')

  console.log(`Seeding prd_copilot with minimal agent-only secrets...`)
  await bulkSetSecrets(apiToken, APP_NAME, 'prd_copilot', nonEmptyCopilotSecrets)

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
