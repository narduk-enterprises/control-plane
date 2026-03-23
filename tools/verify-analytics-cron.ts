#!/usr/bin/env npx tsx
/**
 * verify-analytics-cron.ts — quick prod (or dev) checks for hourly analytics cron + D1 cache
 *
 * Prerequisites:
 *   - Doppler: CRON_SECRET and SITE_URL set for the selected config (e.g. prd)
 *   - Cloudflare: wrangler logged in (CLOUDFLARE_API_TOKEN in env via Doppler)
 *
 * Usage (from repo root):
 *   doppler run -p control-plane -c prd -- npx tsx tools/verify-analytics-cron.ts
 *   doppler run -p control-plane -c prd -- npx tsx tools/verify-analytics-cron.ts --no-curl
 *
 * Tail logs (separate terminal, while triggering cron or waiting for the hour):
 *   cd apps/web && doppler run -p control-plane -c prd -- pnpm exec wrangler tail control-plane --format pretty
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')
const WEB = resolve(ROOT, 'apps/web')

function arg(name: string) {
  return process.argv.includes(name)
}

async function main() {
  const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '')
  const cronSecret = process.env.CRON_SECRET || ''

  console.log('\n=== Analytics cron verification ===\n')

  if (!cronSecret) {
    console.error('❌ CRON_SECRET is empty. Set it in Doppler (prd), then redeploy:')
    console.error(
      '   doppler secrets set CRON_SECRET="$(openssl rand -hex 32)" -p control-plane -c prd',
    )
    process.exit(1)
  }
  console.log(`✅ CRON_SECRET is set (${cronSecret.length} chars)`)

  if (!siteUrl) {
    console.error('❌ SITE_URL is empty. Needed to hit /_cron/fleet-status.')
    process.exit(1)
  }
  console.log(`✅ SITE_URL=${siteUrl}`)

  const wranglerPath = resolve(WEB, 'wrangler.json')
  const wrangler = JSON.parse(readFileSync(wranglerPath, 'utf8')) as {
    name: string
    d1_databases?: { database_name: string }[]
  }
  const workerName = wrangler.name
  const dbName = wrangler.d1_databases?.[0]?.database_name
  if (!dbName) {
    console.error('❌ No D1 database in apps/web/wrangler.json')
    process.exit(1)
  }

  if (!arg('--no-curl')) {
    console.log(`\n→ GET ${siteUrl}/_cron/fleet-status …`)
    try {
      const out = execSync(`curl -sS "${siteUrl}/_cron/fleet-status"`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 2_000_000,
      })
      const json = JSON.parse(out) as {
        ok?: boolean
        cronSecretConfigured?: boolean
        warmed?: number
        aggregated?: boolean
        checked?: number
      }
      console.log(JSON.stringify(json, null, 2))
      if (json.cronSecretConfigured === false) {
        console.error(
          '\n❌ Worker still has no CRON_SECRET at runtime — redeploy after setting Doppler secret.',
        )
        process.exit(1)
      }
      if (json.aggregated === false && (json.warmed ?? 0) === 0 && (json.checked ?? 0) > 0) {
        console.warn('\n⚠️ Cron ran but may have skipped work (time budget). Check Worker logs.')
      }
    } catch (e: unknown) {
      const err = e as { stderr?: string; message?: string }
      console.error('❌ curl failed:', err.stderr || err.message || e)
      process.exit(1)
    }
  } else {
    console.log('\n⏭ Skipped HTTP trigger (--no-curl)')
  }

  console.log(`\n→ D1 remote: row count in kv_cache (${dbName}) …`)
  try {
    execSync(
      `pnpm exec wrangler d1 execute ${dbName} --remote --command "SELECT COUNT(*) AS rows FROM kv_cache"`,
      {
        cwd: WEB,
        stdio: 'inherit',
        env: process.env,
        shell: true,
      },
    )
  } catch {
    console.error('❌ wrangler d1 execute failed (check CLOUDFLARE_API_TOKEN / login).')
    process.exit(1)
  }

  console.log(`\n→ Sample cache keys (expires soonest first) …`)
  try {
    execSync(
      `pnpm exec wrangler d1 execute ${dbName} --remote --command "SELECT key, datetime(expires_at, 'unixepoch') AS expires_utc FROM kv_cache ORDER BY expires_at ASC LIMIT 8"`,
      {
        cwd: WEB,
        stdio: 'inherit',
        env: process.env,
        shell: true,
      },
    )
  } catch {
    console.error('❌ wrangler d1 sample query failed.')
    process.exit(1)
  }

  console.log('\n=== Tail prod logs (run in another terminal) ===')
  console.log(
    `  cd apps/web && doppler run -p control-plane -c prd -- pnpm exec wrangler tail ${workerName} --format pretty`,
  )
  console.log('  Look for: [Cron:fleet-status] start … / done …\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
