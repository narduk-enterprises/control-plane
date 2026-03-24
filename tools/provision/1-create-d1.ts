import fs from 'node:fs'
import { createD1Database } from '../../apps/web/server/utils/provision-cloudflare'

async function main() {
  const APP_NAME = process.argv.find((a) => a.startsWith('--app-name='))?.split('=')[1]
  if (!APP_NAME) throw new Error('--app-name is required')

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = process.env.CLOUDFLARE_API_TOKEN

  if (!accountId || !apiToken) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required in environment')
  }

  const dbName = `${APP_NAME}-db`
  console.log(`Provisioning D1 database: ${dbName}`)

  const db = await createD1Database(accountId, apiToken, dbName)

  console.log(`✅ D1 database ready: ${db.uuid}`)

  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(process.env.GITHUB_ENV, `D1_DATABASE_ID=${db.uuid}\n`)
    fs.appendFileSync(process.env.GITHUB_ENV, `D1_DATABASE_NAME=${db.name}\n`)
  }
}

main().catch((err) => {
  console.error('❌ D1 Provisioning failed:', err)
  process.exit(1)
})
