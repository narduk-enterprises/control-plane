/**
 * Migrate fleet Doppler projects from cross-project references to Config Inheritance.
 *
 * Architecture (Flat Inheritance — no chaining):
 *   hub/prd (inheritable) → spoke/prd (child — inherits hub secrets)
 *   hub/prd (inheritable) → spoke/dev (child — also inherits hub secrets)
 *
 * Doppler constraint: an inheritable config cannot also inherit from other configs.
 * Therefore spoke/prd cannot be both inheritable (for spoke/dev) and inherit hub/prd.
 * Both spoke/prd and spoke/dev inherit directly from hub/prd.
 *
 * Per-app secrets (APP_NAME, CRON_SECRET, etc.) remain stored directly in both
 * prd and dev configs. Only the 16 hub cross-project reference strings are removed.
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
  const filterArg = process.argv.find((a) => a.startsWith('--filter-apps='))
  const filterApps = filterArg ? new Set(filterArg.split('=')[1].split(',')) : null

  const apiToken = process.env.DOPPLER_API_TOKEN || process.env.DOPPLER_TOKEN
  if (!apiToken) {
    throw new Error('DOPPLER_API_TOKEN or DOPPLER_TOKEN is required in environment')
  }

  const apps = filterApps ? FLEET_APPS.filter((a) => filterApps.has(a)) : FLEET_APPS

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Doppler Config Inheritance Migration`)
  console.log(`Mode: ${dryRun ? '🏜️  DRY RUN' : '🔥 LIVE'}`)
  console.log(`Apps: ${apps.length} / ${FLEET_APPS.length}`)
  console.log(`${'='.repeat(60)}\n`)

  // Step 1: Ensure hub/prd is marked inheritable
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
      // 2a. Link spoke/prd → hub/prd (flat inheritance — prd gets hub secrets)
      console.log(`  🔗 Linking ${app}/prd → ${HUB_PROJECT}/${HUB_CONFIG}...`)
      if (!dryRun) {
        await setConfigInherits(apiToken, app, 'prd', [
          { project: HUB_PROJECT, config: HUB_CONFIG },
        ])
      }

      // 2b. Link spoke/dev → hub/prd (flat inheritance — dev also gets hub secrets)
      console.log(`  🔗 Linking ${app}/dev → ${HUB_PROJECT}/${HUB_CONFIG}...`)
      if (!dryRun) {
        await setConfigInherits(apiToken, app, 'dev', [
          { project: HUB_PROJECT, config: HUB_CONFIG },
        ])
      }

      // 2c. Remove old hub ref keys from spoke/prd
      // These keys were previously set as cross-project references.
      // Now they flow via inheritance and must be deleted so they
      // don't override the inherited values.
      console.log(`  🗑️  Cleaning hub ref keys from ${app}/prd...`)
      let prdSecrets: Record<string, string> = {}
      try {
        prdSecrets = await getDopplerSecrets(apiToken, app, 'prd')
      } catch {
        console.log(`  ⚠️  Could not read ${app}/prd secrets — skipping cleanup`)
      }

      const prdKeysToDelete = OLD_HUB_REF_KEYS.filter((key) => key in prdSecrets)
      if (prdKeysToDelete.length > 0) {
        console.log(`  🗑️  Deleting ${prdKeysToDelete.length} hub keys from ${app}/prd`)
        if (!dryRun) {
          await deleteSecrets(apiToken, app, 'prd', prdKeysToDelete)
        }
      } else {
        console.log(`  ℹ️  No hub keys in ${app}/prd (already clean)`)
      }

      // 2d. Remove old hub ref keys from spoke/dev
      console.log(`  🗑️  Cleaning hub ref keys from ${app}/dev...`)
      let devSecrets: Record<string, string> = {}
      try {
        devSecrets = await getDopplerSecrets(apiToken, app, 'dev')
      } catch {
        console.log(`  ⚠️  Could not read ${app}/dev secrets — skipping cleanup`)
      }

      const devKeysToDelete = OLD_HUB_REF_KEYS.filter((key) => key in devSecrets)
      if (devKeysToDelete.length > 0) {
        console.log(`  🗑️  Deleting ${devKeysToDelete.length} hub keys from ${app}/dev`)
        if (!dryRun) {
          await deleteSecrets(apiToken, app, 'dev', devKeysToDelete)
        }
      } else {
        console.log(`  ℹ️  No hub keys in ${app}/dev (already clean)`)
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
