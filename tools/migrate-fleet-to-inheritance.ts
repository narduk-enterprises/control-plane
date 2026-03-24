/**
 * Migrate fleet Doppler projects from cross-project references to Config Inheritance.
 *
 * What this does:
 * 1. Marks hub/prd as inheritable
 * 2. For each fleet app:
 *    a. Marks spoke/prd as inheritable (so spoke/dev can inherit)
 *    b. Links spoke/prd → hub/prd
 *    c. Links spoke/dev → spoke/prd
 *    d. Removes old cross-project reference strings from spoke/prd
 *    e. Removes duplicated secrets from spoke/dev (keeping only SITE_URL + NUXT_PORT)
 *
 * Usage:
 *   doppler run --project control-plane --config prd -- npx tsx tools/migrate-fleet-to-inheritance.ts
 *   doppler run --project control-plane --config prd -- npx tsx tools/migrate-fleet-to-inheritance.ts --dry-run
 *   doppler run --project control-plane --config prd -- npx tsx tools/migrate-fleet-to-inheritance.ts --filter-apps=clawdle,drift-map
 */

import {
  setConfigInheritable,
  setConfigInherits,
  getDopplerSecrets,
  bulkSetSecrets,
  deleteSecrets,
} from '../apps/web/server/utils/provision-doppler'

const HUB_PROJECT = 'narduk-nuxt-template'
const HUB_CONFIG = 'prd'

/** Keys that were previously set as cross-project references (`${hub.prd.KEY}`). */
const OLD_HUB_REF_KEYS = [
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'CONTROL_PLANE_API_KEY',
  'GITHUB_TOKEN_PACKAGES_READ',
  'POSTHOG_PUBLIC_KEY',
  'POSTHOG_PROJECT_ID',
  'POSTHOG_HOST',
  'POSTHOG_PERSONAL_API_KEY',
  'GA_ACCOUNT_ID',
  'GSC_SERVICE_ACCOUNT_JSON',
  'GSC_USER_EMAIL',
  'APPLE_KEY_ID',
  'APPLE_SECRET_KEY',
  'APPLE_TEAM_ID',
  'CSP_SCRIPT_SRC',
  'CSP_CONNECT_SRC',
]

/** Secrets that are per-app and should NOT be deleted from prd. */
const PER_APP_SECRETS = new Set([
  'APP_NAME',
  'SITE_URL',
  'CRON_SECRET',
  'NUXT_SESSION_PASSWORD',
  'GA_MEASUREMENT_ID',
  'INDEXNOW_KEY',
  'NUXT_PORT',
])

/** Secrets to always keep in dev (overrides). */
const DEV_KEEP_KEYS = new Set([
  'SITE_URL',
  'NUXT_PORT',
])

/** Fleet apps — sourced from managed-repos.ts */
const FLEET_APPS = [
  'ai-media-gen',
  'austin-texas-net',
  'bluebonnet-status-online',
  'boat-search',
  'circuit-breaker-online',
  'clawdle',
  'control-plane',
  'drift-map',
  'enigma-box',
  'favicon-checker',
  'flashcard-pro',
  'imessage-dictionary',
  'lucys-loomies',
  'nagolnagemluapleira',
  'napkinbets',
  'narduk-ai',
  'narduk-enterprises-portfolio',
  'neon-sewer-raid',
  'ogpreview-app',
  'old-austin-grouch',
  'papa-everetts-pizza',
  'paul',
  'sailing-passage-map',
  'scorchin-tims',
  'tide-check',
  'tideye',
  'tiny-invoice',
  'video-grab',
  'wan-video-review',
  'where-run',
]

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const filterArg = process.argv.find(a => a.startsWith('--filter-apps='))
  const filterApps = filterArg
    ? new Set(filterArg.split('=')[1].split(','))
    : null

  const apiToken = process.env.DOPPLER_API_TOKEN || process.env.DOPPLER_TOKEN
  if (!apiToken) {
    throw new Error('DOPPLER_API_TOKEN or DOPPLER_TOKEN is required in environment')
  }

  const apps = filterApps
    ? FLEET_APPS.filter(a => filterApps.has(a))
    : FLEET_APPS

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Doppler Config Inheritance Migration`)
  console.log(`Mode: ${dryRun ? '🏜️  DRY RUN' : '🔥 LIVE'}`)
  console.log(`Apps: ${apps.length} / ${FLEET_APPS.length}`)
  console.log(`${'='.repeat(60)}\n`)

  // Step 1: Mark hub/prd as inheritable
  console.log(`\n📦 Step 1: Mark ${HUB_PROJECT}/${HUB_CONFIG} as inheritable`)
  if (!dryRun) {
    await setConfigInheritable(apiToken, HUB_PROJECT, HUB_CONFIG, true)
  }
  console.log(`  ✅ ${HUB_PROJECT}/${HUB_CONFIG} → inheritable`)

  let successCount = 0
  let errorCount = 0

  // Step 2: Process each fleet app
  for (const app of apps) {
    console.log(`\n${'─'.repeat(50)}`)
    console.log(`🔧 Processing: ${app}`)
    console.log(`${'─'.repeat(50)}`)

    try {
      // 2a. Mark spoke/prd as inheritable
      console.log(`  📌 Marking ${app}/prd as inheritable...`)
      if (!dryRun) {
        await setConfigInheritable(apiToken, app, 'prd', true)
      }

      // 2b. Link spoke/prd → hub/prd
      console.log(`  🔗 Linking ${app}/prd → ${HUB_PROJECT}/${HUB_CONFIG}...`)
      if (!dryRun) {
        await setConfigInherits(apiToken, app, 'prd', [
          { project: HUB_PROJECT, config: HUB_CONFIG },
        ])
      }

      // 2c. Link spoke/dev → spoke/prd
      console.log(`  🔗 Linking ${app}/dev → ${app}/prd...`)
      if (!dryRun) {
        await setConfigInherits(apiToken, app, 'dev', [
          { project: app, config: 'prd' },
        ])
      }

      // 2d. Remove old cross-project reference strings from spoke/prd
      // These are now inherited and would show as "overridden" in the UI
      console.log(`  🗑️  Cleaning up old hub refs from ${app}/prd...`)
      let prdSecrets: Record<string, string> = {}
      try {
        prdSecrets = await getDopplerSecrets(apiToken, app, 'prd')
      } catch {
        console.log(`  ⚠️  Could not read ${app}/prd secrets — skipping cleanup`)
      }

      const refKeysToDelete: string[] = []
      for (const key of OLD_HUB_REF_KEYS) {
        const value = prdSecrets[key]
        if (value && value.startsWith('${') && value.includes(HUB_PROJECT)) {
          refKeysToDelete.push(key)
        }
      }

      if (refKeysToDelete.length > 0) {
        console.log(`  🗑️  Deleting ${refKeysToDelete.length} old ref keys from ${app}/prd: ${refKeysToDelete.join(', ')}`)
        if (!dryRun) {
          await deleteSecrets(apiToken, app, 'prd', refKeysToDelete)
        }
      } else {
        console.log(`  ℹ️  No old hub refs found in ${app}/prd (may already be clean)`)
      }

      // 2e. Clean up dev config — remove everything except SITE_URL and NUXT_PORT
      console.log(`  🗑️  Cleaning up ${app}/dev (keeping only SITE_URL + NUXT_PORT)...`)
      let devSecrets: Record<string, string> = {}
      try {
        devSecrets = await getDopplerSecrets(apiToken, app, 'dev')
      } catch {
        console.log(`  ⚠️  Could not read ${app}/dev secrets — skipping cleanup`)
      }

      const devKeysToDelete: string[] = []
      for (const key of Object.keys(devSecrets)) {
        // Keep dev-specific overrides and Doppler metadata
        if (!DEV_KEEP_KEYS.has(key) && !key.startsWith('DOPPLER_')) {
          devKeysToDelete.push(key)
        }
      }

      if (devKeysToDelete.length > 0) {
        console.log(`  🗑️  Deleting ${devKeysToDelete.length} inherited/duplicated keys from ${app}/dev`)
        if (devKeysToDelete.length <= 10) {
          console.log(`      Keys: ${devKeysToDelete.join(', ')}`)
        }
        if (!dryRun) {
          await deleteSecrets(apiToken, app, 'dev', devKeysToDelete)
        }
      } else {
        console.log(`  ℹ️  ${app}/dev already clean`)
      }

      console.log(`  ✅ ${app} migrated successfully`)
      successCount++
    } catch (err) {
      console.error(`  ❌ ${app} FAILED:`, err instanceof Error ? err.message : err)
      errorCount++
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Migration ${dryRun ? '(dry run) ' : ''}complete`)
  console.log(`  ✅ Success: ${successCount}`)
  console.log(`  ❌ Failed:  ${errorCount}`)
  console.log(`${'='.repeat(60)}\n`)

  if (errorCount > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})
