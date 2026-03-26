/**
 * Remote D1 read/write for fleet apps via Cloudflare REST API.
 * Database naming matches provisioning: `{appName}-db` unless overridden.
 */
import {
  getD1DatabaseByName,
  queryD1Database,
  type D1RemoteQueryStatementResult,
} from './provision-cloudflare'

export function defaultFleetD1DatabaseName(appName: string): string {
  return `${appName}-db`
}

export async function resolveFleetD1DatabaseUuid(
  accountId: string,
  apiToken: string,
  appName: string,
  databaseName?: string,
): Promise<{ uuid: string; name: string }> {
  const name = (databaseName?.trim() || defaultFleetD1DatabaseName(appName)).trim()
  const db = await getD1DatabaseByName(accountId, apiToken, name)
  if (!db) {
    throw new Error(`No D1 database named "${name}" in Cloudflare account ${accountId}`)
  }
  return { uuid: db.uuid, name: db.name }
}

export async function executeSqlOnFleetAppD1(options: {
  accountId: string
  apiToken: string
  appName: string
  sql: string
  params?: string[]
  /** Override default `{appName}-db` */
  databaseName?: string
  /** Skip name lookup when you already have the UUID */
  databaseId?: string
}): Promise<{
  databaseId: string
  databaseName: string
  result: D1RemoteQueryStatementResult[]
}> {
  const { accountId, apiToken, appName, sql, params, databaseName, databaseId } = options

  let uuid: string
  let name: string

  if (databaseId?.trim()) {
    uuid = databaseId.trim()
    name = databaseName?.trim() || uuid
  } else {
    const resolved = await resolveFleetD1DatabaseUuid(accountId, apiToken, appName, databaseName)
    uuid = resolved.uuid
    name = resolved.name
  }

  const result = await queryD1Database(accountId, apiToken, uuid, sql, params)
  return { databaseId: uuid, databaseName: name, result }
}
