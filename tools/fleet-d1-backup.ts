/**
 * Remote D1 SQL dump via Wrangler (`d1 export --remote`). Writes under `backups/d1/<run-id>/`.
 *
 * Usage:
 *   doppler run -p control-plane -c prd -- pnpm run fleet:d1:backup -- --app=austin-texas-net
 *   pnpm run fleet:d1:backup -- --apps=austin-texas-net,old-austin-grouch
 *   pnpm run fleet:d1:backup -- --db-name=my-db
 *
 * Options:
 *   --app=<name>       Export `<name>` and `<name>-db` (skips missing / failed exports)
 *   --apps=a,b         Multiple `--app` behavior
 *   --db-name=<name>   Single database name
 *   --no-schema        Pass through to wrangler (data-only dump)
 *   --no-data          Pass through to wrangler (schema-only dump)
 *
 * Requires: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (wrangler uses same env)
 */

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

function argValue(prefix: string): string | undefined {
  const raw = process.argv.find((a) => a.startsWith(prefix))
  return raw?.slice(prefix.length)
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function runId(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
}

function exportOne(
  dbName: string,
  outFile: string,
  extra: string[],
): { ok: boolean; stderr: string; stdout: string } {
  const args = [
    'exec',
    'wrangler',
    'd1',
    'export',
    dbName,
    '--remote',
    '--output',
    outFile,
    ...extra,
  ]
  const r = spawnSync('pnpm', args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf-8',
    stdio: 'pipe',
  })
  return {
    ok: r.status === 0,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  }
}

function main() {
  const appsRaw = argValue('--apps=')
  const appSingle = argValue('--app=')
  const dbNameSingle = argValue('--db-name=')

  const extra: string[] = []
  if (hasFlag('--no-schema')) extra.push('--no-schema')
  if (hasFlag('--no-data')) extra.push('--no-data')

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim()
  if (!accountId || !token) {
    console.error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required in the environment.')
    process.exit(1)
  }

  const names = new Set<string>()
  if (dbNameSingle?.trim()) names.add(dbNameSingle.trim())
  if (appSingle?.trim()) {
    const a = appSingle.trim()
    names.add(a)
    names.add(`${a}-db`)
  }
  if (appsRaw?.trim()) {
    for (const part of appsRaw.split(',')) {
      const a = part.trim()
      if (!a) continue
      names.add(a)
      names.add(`${a}-db`)
    }
  }

  if (names.size === 0) {
    console.error('Provide --app=<fleet-name>, --apps=a,b, and/or --db-name=<d1-name>')
    process.exit(1)
  }

  const dir = join(process.cwd(), 'backups', 'd1', runId())
  mkdirSync(dir, { recursive: true })

  const sorted = [...names].sort((a, b) => a.localeCompare(b))
  console.log(`Output directory: ${dir}\n`)

  let ok = 0
  let fail = 0
  for (const db of sorted) {
    const safe = db.replace(/[^\w.-]+/g, '_')
    const outFile = join(dir, `${safe}.sql`)
    process.stdout.write(`Exporting ${db} ... `)
    const r = exportOne(db, outFile, extra)
    if (r.ok) {
      console.log('ok')
      ok++
    } else {
      console.log('failed')
      fail++
      if (r.stderr) console.error(r.stderr.trimEnd())
      else if (r.stdout) console.error(r.stdout.trimEnd())
    }
  }

  console.log(`\nDone: ${ok} succeeded, ${fail} failed`)
  if (ok === 0) process.exit(1)
}

main()
