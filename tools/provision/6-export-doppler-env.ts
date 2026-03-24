import { getDopplerSecrets } from '../../apps/web/server/utils/provision-doppler'
import { appendGitHubEnv } from './github-actions-env'

async function main() {
  const project =
    process.argv.find((arg) => arg.startsWith('--app-name='))?.split('=')[1] ||
    process.argv.find((arg) => arg.startsWith('--project='))?.split('=')[1]
  const config = process.argv.find((arg) => arg.startsWith('--config='))?.split('=')[1] || 'prd'
  const dopplerToken =
    process.env.APP_DOPPLER_TOKEN || process.env.DOPPLER_API_TOKEN || process.env.DOPPLER_TOKEN

  if (!project) {
    throw new Error('--app-name or --project is required')
  }
  if (!dopplerToken) {
    throw new Error(
      'APP_DOPPLER_TOKEN, DOPPLER_API_TOKEN, or DOPPLER_TOKEN is required in environment',
    )
  }

  console.log(`Exporting Doppler secrets for ${project}/${config}...`)
  const secrets = await getDopplerSecrets(dopplerToken, project, config)

  for (const [key, value] of Object.entries(secrets)) {
    appendGitHubEnv(key, value)
  }

  console.log(`✅ Exported ${Object.keys(secrets).length} Doppler secret(s) to GITHUB_ENV.`)
}

main().catch((err) => {
  console.error('❌ Doppler env export failed:', err)
  process.exit(1)
})
