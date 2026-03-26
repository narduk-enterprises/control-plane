/**
 * Compare the two Cloudflare D1 databases that fleet audits warn about:
 * bare `{app}` vs template `{app}-db`. Read-only — uses the Cloudflare API.
 *
 * Usage:
 *   doppler run -p control-plane -c prd -- pnpm exec tsx tools/fleet-d1-twin-compare.ts --app=old-austin-grouch
 *   pnpm exec tsx tools/fleet-d1-twin-compare.ts --app=austin-texas-net --json
 *   pnpm exec tsx tools/fleet-d1-twin-compare.ts --app=old-austin-grouch --print-runbook
 *   pnpm exec tsx tools/fleet-d1-twin-compare.ts --apps=austin-texas-net,old-austin-grouch --dry-run
 *
 * Requires: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (D1 read is enough; token usually has edit)
 *
 * -----------------------------------------------------------------------------
 * SAFE CONSOLIDATION RUNBOOK (data lived on bare `myapp`, worker binds `myapp-db`)
 * -----------------------------------------------------------------------------
 * 1) Compare (this script). Decide SOURCE = DB that has real rows; DEST = `myapp-db`
 *    unless you intentionally standardize on bare (not recommended — template/CI use `-db`).
 * 2) If DEST is empty or only internal tables: apply the same schema/migrations DEST as prod
 *    expects, e.g. from the app repo:
 *      pnpm exec wrangler d1 migrations apply <BINDING_NAME> --remote
 *    (or run your drizzle SQL in order — match what CI deploy does.)
 * 3) Export from SOURCE (data-only avoids re-applying schema on DEST):
 *      pnpm exec wrangler d1 export myapp --remote --no-schema --output /tmp/myapp-data.sql
 *    If DEST is completely empty and has no migrations table yet, full export is OK:
 *      pnpm exec wrangler d1 export myapp --remote --output /tmp/myapp-full.sql
 * 4) Edit the SQL if needed: drop any INSERT into `d1_migrations` from SOURCE if DEST already
 *    has migrations applied (duplicate keys). Prefer exporting app tables only via --table (repeat)
 *    if wrangler supports multiple passes, or trim the file manually.
 * 5) Import into DEST:
 *      pnpm exec wrangler d1 execute myapp-db --remote --file=/tmp/myapp-data.sql
 * 6) Re-run this script; counts on DEST should match SOURCE for app tables.
 * 7) Verify the live Worker (read/write). Then remove maintenance.
 * 8) Delete SOURCE only after you are sure nothing binds it:
 *      pnpm exec wrangler d1 delete myapp
 * -----------------------------------------------------------------------------
 * If BOTH databases have app data, do not blind-import — merge manually or pick a winner.
 */

import {
  getD1DatabaseByName,
  queryD1Database,
} from '../apps/web/server/utils/provision-cloudflare'
import {
  assertFirstStatementOk,
  firstStatementScalar,
  normalizeD1StatementRows,
  pickSqliteMasterTableName,
  shouldListFleetTable,
} from '../apps/web/server/utils/fleet-d1-studio'

function argValue(prefix: string): string | undefined {
  const raw = process.argv.find((a) => a.startsWith(prefix))
  return raw?.slice(prefix.length)
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

async function listUserTableNames(
  accountId: string,
  token: string,
  databaseId: string,
): Promise<string[]> {
  const batches = await queryD1Database(
    accountId,
    token,
    databaseId,
    `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
  )
  assertFirstStatementOk(batches, 'sqlite_master')
  const rows = normalizeD1StatementRows(batches[0])
  const names = rows
    .map(pickSqliteMasterTableName)
    .filter((n): n is string => n !== null)
  return names.filter(shouldListFleetTable)
}

async function countRows(
  accountId: string,
  token: string,
  databaseId: string,
  table: string,
): Promise<number> {
  const sql = `SELECT COUNT(*) AS n FROM ${quoteIdent(table)}`
  const batches = await queryD1Database(accountId, token, databaseId, sql)
  assertFirstStatementOk(batches, `COUNT(*) on ${table}`)
  return firstStatementScalar(batches, 'n')
}

async function snapshotDb(
  accountId: string,
  token: string,
  label: string,
  dbName: string,
): Promise<{
  label: string
  dbName: string
  uuid: string | null
  tables: Record<string, number>
  error?: string
}> {
  const meta = await getD1DatabaseByName(accountId, token, dbName)
  if (!meta) {
    return { label, dbName, uuid: null, tables: {} }
  }
  try {
    const tables = await listUserTableNames(accountId, token, meta.uuid)
    const counts: Record<string, number> = {}
    for (const t of tables) {
      counts[t] = await countRows(accountId, token, meta.uuid, t)
    }
    return { label, dbName, uuid: meta.uuid, tables: counts }
  } catch (e) {
    return {
      label,
      dbName,
      uuid: meta.uuid,
      tables: {},
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

function totalUserRows(tables: Record<string, number>): number {
  return Object.values(tables).reduce((sum, n) => sum + n, 0)
}

function printMigrationDryRun(
  app: string,
  bare: Awaited<ReturnType<typeof snapshotDb>>,
  canonical: Awaited<ReturnType<typeof snapshotDb>>,
): void {
  const bareName = app
  const destName = `${app}-db`
  const exportFile = `/tmp/${app}-d1-data-import.sql`

  const bareTotal = totalUserRows(bare.tables)
  const canTotal = totalUserRows(canonical.tables)

  console.log('\n======== MIGRATION DRY RUN (no Cloudflare writes) ========\n')

  if (!bare.uuid || !canonical.uuid) {
    console.log('Skip migration plan: need both databases present in account.')
    return
  }

  console.log(`Bare "${bareName}" — user-table row sum: ${bareTotal}`)
  console.log(`Canonical "${destName}" — user-table row sum: ${canTotal}`)

  const bareKeys = Object.keys(bare.tables)
  const canKeys = Object.keys(canonical.tables)
  const overlap = bareKeys.filter((t) => canKeys.includes(t))
  const conflicts: string[] = []
  for (const t of overlap) {
    const b = bare.tables[t] ?? 0
    const c = canonical.tables[t] ?? 0
    if (b > 0 && c > 0) conflicts.push(`${t}: bare=${b} ${destName}=${c}`)
  }

  if (conflicts.length > 0) {
    console.log('\n⚠ Tables with rows on BOTH sides (import may duplicate PKs — resolve first):')
    for (const line of conflicts) console.log(`    ${line}`)
  } else {
    console.log('\n✓ No table has rows on both sides; data-only import is unlikely to PK-collide.')
  }

  const hasMigrationsBare =
    (bare.tables.d1_migrations ?? 0) > 0 || (bare.tables._applied_migrations ?? 0) > 0
  const hasMigrationsDest =
    (canonical.tables.d1_migrations ?? 0) > 0 ||
    (canonical.tables._applied_migrations ?? 0) > 0

  console.log(`\nAssumption: Worker + CI target "${destName}" (narduk template).`)
  console.log(`Recommended data SOURCE: "${bareName}" (has the app data).`)
  console.log(`Recommended data DEST: "${destName}".`)

  if (canTotal > bareTotal && canTotal > 100) {
    console.log(
      `\n⚠ Unusual: "${destName}" has more user rows than bare — verify source of truth before deleting "${bareName}".`,
    )
  }

  console.log('\n--- Commands that would be run manually (NOT executed by this tool) ---\n')
  console.log(
    `A) From the ${app} app repo (match CI): bring "${destName}" schema to current, e.g.\n` +
      `   pnpm exec wrangler d1 migrations apply <binding> --remote\n` +
      `   (or drizzle SQL files in deploy order if that is what CI uses.)`,
  )
  console.log(
    `\nB) Export data only from SOURCE:\n` +
      `   pnpm exec wrangler d1 export ${bareName} --remote --no-schema --output ${exportFile}`,
  )
  if (hasMigrationsBare || hasMigrationsDest) {
    console.log(
      `\nC) Edit ${exportFile}: remove INSERT/DELETE touching d1_migrations and _applied_migrations\n` +
        `   if "${destName}" already records migrations (avoids duplicate / skew).`,
    )
  }
  console.log(
    `\nD) Import into "${destName}":\n` +
      `   pnpm exec wrangler d1 execute ${destName} --remote --file=${exportFile}`,
  )
  console.log(
    `\nE) Verify:\n` +
      `   pnpm exec tsx tools/fleet-d1-twin-compare.ts --app=${app}`,
  )
  console.log(
    `\nF) After production smoke test, delete stray DB:\n` +
      `   pnpm exec wrangler d1 delete ${bareName}`,
  )
  console.log('\n======== end dry run ========\n')
}

function printRunbook(app: string): void {
  const bare = app
  const canonical = `${app}-db`
  console.log(`
Safe migration: consolidate into "${canonical}" (template / wrangler default)

1) Inspect both (already done with --app):
   - "${bare}"  vs  "${canonical}"

2) Put app in maintenance if you need zero writes during copy.

3) Ensure "${canonical}" has schema (migrations) matching production code — run from the app repo:
   wrangler d1 migrations apply <binding> --remote
   (Skip if you will import a full SQL dump including schema from source.)

4) Export from the database that HOLDS the data you want to keep (often "${bare}"):
   pnpm exec wrangler d1 export ${bare} --remote --no-schema --output /tmp/${app}-data.sql

5) If "${canonical}" already has d1_migrations rows, remove INSERTs into d1_migrations from the dump.

6) Import:
   pnpm exec wrangler d1 execute ${canonical} --remote --file=/tmp/${app}-data.sql

7) Re-run: pnpm exec tsx tools/fleet-d1-twin-compare.ts --app=${app}

8) Smoke-test the site; then delete the unused DB:
   pnpm exec wrangler d1 delete ${bare}

If BOTH have non-zero app data, stop and merge manually — do not overwrite blindly.
`)
}

async function runOneApp(app: string, options: { json: boolean; dryRun: boolean }): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim()
  if (!accountId || !token) {
    console.error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required')
    process.exit(1)
  }

  const bareName = app
  const dbName = `${app}-db`

  const [bare, canonical] = await Promise.all([
    snapshotDb(accountId, token, 'bare', bareName),
    snapshotDb(accountId, token, 'canonical (-db)', dbName),
  ])

  const payload = {
    app,
    databases: { bare, canonical },
    dryRun: options.dryRun,
    hint:
      bare.uuid && canonical.uuid
        ? 'Both exist: export data from the DB that has rows, import into the one wrangler binds (' +
          dbName +
          '), then delete the spare after verification.'
        : bare.uuid && !canonical.uuid
          ? `Only "${bareName}" exists; create or rename to "${dbName}" to match template, or re-point wrangler (not recommended).`
          : !bare.uuid && canonical.uuid
            ? `Only "${dbName}" exists — good. No twin consolidation needed.`
            : `Neither "${bareName}" nor "${dbName}" found in this account.`,
  }

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2))
    return
  }

  console.log(`Fleet app: ${app}\n`)
  for (const side of [bare, canonical]) {
    console.log(`--- ${side.label}: ${side.dbName} ---`)
    if (side.error) {
      console.log(`  error: ${side.error}`)
      continue
    }
    if (!side.uuid) {
      console.log('  (not found in account)')
      continue
    }
    console.log(`  uuid: ${side.uuid}`)
    const entries = Object.entries(side.tables).sort((a, b) => a[0].localeCompare(b[0]))
    if (entries.length === 0) {
      console.log('  user tables: (none)')
    } else {
      console.log('  user tables:')
      for (const [t, n] of entries) {
        console.log(`    ${t}: ${n}`)
      }
    }
  }
  console.log(`\n${payload.hint}`)
  if (options.dryRun) {
    printMigrationDryRun(app, bare, canonical)
  } else {
    console.log(
      `\nFull wrangler steps: pnpm exec tsx tools/fleet-d1-twin-compare.ts --app=${app} --print-runbook`,
    )
    console.log(`Dry run plan: pnpm exec tsx tools/fleet-d1-twin-compare.ts --app=${app} --dry-run`)
  }
}

async function main() {
  const appsRaw = argValue('--apps=')?.trim()
  const appSingle = argValue('--app=')?.trim()
  const apps = appsRaw
    ? appsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : appSingle
      ? [appSingle]
      : []

  if (apps.length === 0) {
    console.error('Missing --app=<fleet-app-name> or --apps=a,b')
    process.exit(1)
  }

  const printRunbookOnly = hasFlag('--print-runbook')
  if (printRunbookOnly) {
    if (apps.length !== 1) {
      console.error('--print-runbook requires a single --app=')
      process.exit(1)
    }
    printRunbook(apps[0]!)
    return
  }

  const json = hasFlag('--json')
  const dryRun = hasFlag('--dry-run')

  if (json && apps.length > 1) {
    console.error('--json supports only one app; use --app=')
    process.exit(1)
  }

  for (let i = 0; i < apps.length; i++) {
    if (apps.length > 1 && !json) {
      console.log('\n████████████████████████████████████████████████████████████\n')
    }
    await runOneApp(apps[i]!, { json, dryRun })
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
