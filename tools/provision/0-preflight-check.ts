async function main() {
  const missing: string[] = []
  const warnings: string[] = []
  const packageRegistryProvider =
    process.env.PACKAGE_REGISTRY_PROVIDER === 'forgejo' ? 'forgejo' : 'github'

  const requiredEnvVars = [
    { label: 'CONTROL_PLANE_URL', keys: ['CONTROL_PLANE_URL'] },
    { label: 'PROVISION_API_KEY', keys: ['PROVISION_API_KEY'] },
    {
      label: 'GH_SERVICE_TOKEN',
      keys: ['GH_SERVICE_TOKEN', 'CONTROL_PLANE_GH_SERVICE_TOKEN'],
    },
    { label: 'FORGEJO_TOKEN', keys: ['FORGEJO_TOKEN'] },
    { label: 'CLOUDFLARE_API_TOKEN', keys: ['CLOUDFLARE_API_TOKEN'] },
    { label: 'CLOUDFLARE_ACCOUNT_ID', keys: ['CLOUDFLARE_ACCOUNT_ID'] },
    { label: 'DOPPLER_API_TOKEN', keys: ['DOPPLER_API_TOKEN', 'DOPPLER_TOKEN'] },
  ]

  if (packageRegistryProvider === 'github') {
    requiredEnvVars.splice(3, 0, {
      label: 'GH_PACKAGES_TOKEN',
      keys: ['GH_PACKAGES_TOKEN', 'GITHUB_PACKAGES_TOKEN', 'GITHUB_TOKEN_PACKAGES_READ'],
    })
  }

  const optionalEnvVars = ['GSC_SERVICE_ACCOUNT_JSON', 'GA_ACCOUNT_ID']

  console.log('✈️  Running preflight checks...')

  for (const envVar of requiredEnvVars) {
    if (!envVar.keys.some((key) => process.env[key])) {
      missing.push(envVar.label)
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

  console.log(
    `✅ Preflight check passed. All required tokens and variables are present for ${packageRegistryProvider} package mode.`,
  )
}

main().catch((err) => {
  console.error('❌ Preflight check encountered an error:', err)
  process.exit(1)
})
