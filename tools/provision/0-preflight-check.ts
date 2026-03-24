async function main() {
  const missing: string[] = []
  const warnings: string[] = []

  const requiredEnvVars = [
    'CONTROL_PLANE_URL',
    'PROVISION_API_KEY',
    'GH_SERVICE_TOKEN',
    'GH_PACKAGES_TOKEN',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID',
    'DOPPLER_API_TOKEN',
  ]

  const optionalEnvVars = ['GSC_SERVICE_ACCOUNT_JSON', 'GA_ACCOUNT_ID']

  console.log('✈️  Running preflight checks...')

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar)
    }
  }

  for (const envVar of optionalEnvVars) {
    if (!process.env[envVar]) {
      warnings.push(envVar)
    }
  }

  if (missing.length > 0) {
    console.error(`❌ Preflight Check Failed! Missing required environment variables:`)
    missing.forEach((v) => console.error(`   - ${v}`))
    console.error(
      `Please ensure these are set as Secrets or Variables in the GitHub Repository running this workflow.`,
    )
    process.exit(1)
  }

  if (warnings.length > 0) {
    console.warn(
      '⚠️ Optional analytics credentials missing. Provisioning will continue without GA/GSC:',
    )
    warnings.forEach((v) => console.warn(`   - ${v}`))
  }

  console.log('✅ Preflight check passed. All required tokens and variables are present.')
}

main().catch((err) => {
  console.error('❌ Preflight check encountered an error:', err)
  process.exit(1)
})
