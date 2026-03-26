/**
 * Run SQL against a fleet app's remote D1 via the Cloudflare API.
 *
 * Usage:
 *   doppler run -p control-plane -c prd -- npx tsx tools/fleet-d1.ts --app=my-app --command "SELECT 1"
 *   npx tsx tools/fleet-d1.ts --app=my-app --file=./patch.sql
 *   npx tsx tools/fleet-d1.ts --app=my-app --db-name=custom-db --command "SELECT 1"
 *   npx tsx tools/fleet-d1.ts --app=my-app --database-id=<uuid> --command "SELECT 1"
 *
 * Requires: CLOUDFLARE_API_TOKEN (D1 edit), CLOUDFLARE_ACCOUNT_ID
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { executeSqlOnFleetAppD1 } from '../apps/web/server/utils/fleet-d1-remote'

function argValue(prefix: string): string | undefined {
  const raw = process.argv.find((a) => a.startsWith(prefix))
  return raw?.slice(prefix.length)
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

async function main() {
  const app = argValue('--app=')
  const command = argValue('--command=') || argValue('-c=')
  const file = argValue('--file=')
  const dbName = argValue('--db-name=')
  const databaseId = argValue('--database-id=')
  const jsonOut = hasFlag('--json')

  if (!app) {
    console.error('Missing --app=<fleet-app-name>')
    process.exit(1)
  }

  let sql: string | undefined
  if (command) {
    sql = command
  } else if (file) {
    sql = readFileSync(resolve(file), 'utf-8')
  }

  if (!sql?.trim()) {
    console.error('Provide --command="SQL" or --file=path.sql')
    process.exit(1)
  }

  if (sql.length > 500_000) {
    console.error('SQL exceeds 500k character limit')
    process.exit(1)
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim()
  if (!accountId || !apiToken) {
    console.error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required')
    process.exit(1)
  }

  if (hasFlag('--dry-run')) {
    console.log(
      JSON.stringify(
        {
          app,
          databaseName: dbName || `${app}-db`,
          databaseId: databaseId || '(resolve by name)',
          sqlBytes: Buffer.byteLength(sql, 'utf8'),
        },
        null,
        2,
      ),
    )
    return
  }

  const out = await executeSqlOnFleetAppD1({
    accountId,
    apiToken,
    appName: app,
    sql,
    databaseName: dbName,
    databaseId,
  })

  if (jsonOut) {
    console.log(JSON.stringify(out, null, 2))
    return
  }

  console.log(`Database: ${out.databaseName} (${out.databaseId})`)
  for (let i = 0; i < out.result.length; i++) {
    const batch = out.result[i]
    console.log(`\n--- statement ${i + 1} ---`)
    if (batch.meta) console.log('meta:', JSON.stringify(batch.meta, null, 2))
    if (batch.results?.length) {
      console.table(batch.results)
    } else if (batch.success === false) {
      console.error('Statement failed')
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
