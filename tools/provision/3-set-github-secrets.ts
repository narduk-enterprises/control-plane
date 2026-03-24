import {
  enableRepoForCopilotCodingAgent,
  setRepoSecret,
} from '../../apps/web/server/utils/provision-github'

async function main() {
  const GITHUB_REPO = process.argv.find((a) => a.startsWith('--github-repo='))?.split('=')[1]
  if (!GITHUB_REPO) throw new Error('--github-repo is required')

  const ghToken = process.env.CONTROL_PLANE_GH_SERVICE_TOKEN || process.env.GH_SERVICE_TOKEN
  if (!ghToken) {
    throw new Error('CONTROL_PLANE_GH_SERVICE_TOKEN or GH_SERVICE_TOKEN is required in environment')
  }

  const dopplerToken = process.env.APP_DOPPLER_TOKEN || process.env.DOPPLER_TOKEN
  const ghPackagesToken =
    process.env.GH_PACKAGES_TOKEN ||
    process.env.GITHUB_PACKAGES_TOKEN ||
    process.env.GITHUB_TOKEN_PACKAGES_READ
  const nodeAuthToken = process.env.NODE_AUTH_TOKEN || ghPackagesToken
  const controlPlaneUrl = process.env.CONTROL_PLANE_URL

  if (!dopplerToken) {
    throw new Error('APP_DOPPLER_TOKEN or DOPPLER_TOKEN is required in environment')
  }

  console.log(`Setting DOPPLER_TOKEN secret...`)
  await setRepoSecret(ghToken, GITHUB_REPO, 'DOPPLER_TOKEN', dopplerToken)

  if (ghPackagesToken) {
    console.log(`Setting GH_PACKAGES_TOKEN secret...`)
    await setRepoSecret(ghToken, GITHUB_REPO, 'GH_PACKAGES_TOKEN', ghPackagesToken)
  }

  const copilotRepoSecrets = {
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || '',
    GH_TOKEN_PACKAGES_READ: ghPackagesToken || '',
    NODE_AUTH_TOKEN: nodeAuthToken || '',
  }

  for (const [secretName, secretValue] of Object.entries(copilotRepoSecrets)) {
    if (!secretValue.trim()) {
      continue
    }

    console.log(`Setting ${secretName} secret...`)
    await setRepoSecret(ghToken, GITHUB_REPO, secretName, secretValue)
  }

  if (controlPlaneUrl) {
    console.log(`Setting CONTROL_PLANE_URL secret...`)
    await setRepoSecret(ghToken, GITHUB_REPO, 'CONTROL_PLANE_URL', controlPlaneUrl)
  }

  console.log(`Configuring Copilot coding agent access...`)
  try {
    const copilotResult = await enableRepoForCopilotCodingAgent(ghToken, GITHUB_REPO)

    if (copilotResult === 'already_enabled_for_all_repositories') {
      console.log(`Copilot coding agent is already enabled for all repositories in this org.`)
    }

    if (copilotResult === 'enabled_for_selected_repositories') {
      console.log(`Enabled Copilot coding agent for ${GITHUB_REPO}.`)
    }

    if (copilotResult === 'disabled_by_org_policy') {
      console.warn(
        `⚠️ Skipping Copilot coding agent enablement for ${GITHUB_REPO}: org policy is set to none.`,
      )
    }

    if (copilotResult === 'unsupported_for_user_repo') {
      console.warn(
        `⚠️ Skipping Copilot coding agent enablement for ${GITHUB_REPO}: owner is not an organization.`,
      )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`⚠️ Copilot coding agent provisioning skipped for ${GITHUB_REPO}: ${message}`)
  }

  console.log(`✅ GitHub repository configuration completed for ${GITHUB_REPO}`)
}

main().catch((err) => {
  console.error('❌ GitHub Secrets Provisioning failed:', err)
  process.exit(1)
})
