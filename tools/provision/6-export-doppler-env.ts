import fs from 'node:fs'
import { getDopplerSecrets } from '../../apps/web/server/utils/provision-doppler'

function appendGitHubEnv(key: string, value: string) {
  const githubEnvPath = process.env.GITHUB_ENV
  if (!githubEnvPath) {
    throw new Error('GITHUB_ENV is required to export Doppler secrets')
  }

  const eof = `__DOPPLER_${key}_${Date.now()}__`
  fs.appendFileSync(githubEnvPath, `${key}<<${eof}\n${value}\n${eof}\n`)
}

async function main() {
  const project =
    process.argv.find((arg) => arg.startsWith('--app-name='))?.split('=')[1] ||
    process.argv.find((arg) => arg.startsWith('--project='))?.split('=')[1]
  const config = process.argv.find((arg) => arg.startsWith('--config='))?.split('=')[1] || 'prd'
  const dopplerToken = process.env.APP_DOPPLER_TOKEN || process.env.DOPPLER_TOKEN

  if (!project) {
    throw new Error('--app-name or --project is required')
  }
  if (!dopplerToken) {
    throw new Error('APP_DOPPLER_TOKEN or DOPPLER_TOKEN is required in environment')
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
