import { setRepoSecret } from '../../apps/web/server/utils/provision-github'

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

  if (controlPlaneUrl) {
    console.log(`Setting CONTROL_PLANE_URL secret...`)
    await setRepoSecret(ghToken, GITHUB_REPO, 'CONTROL_PLANE_URL', controlPlaneUrl)
  }

  console.log(`✅ GitHub secrets configured for ${GITHUB_REPO}`)
}

main().catch((err) => {
  console.error('❌ GitHub Secrets Provisioning failed:', err)
  process.exit(1)
})
