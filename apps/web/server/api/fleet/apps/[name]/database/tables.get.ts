import { z } from 'zod'
import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { executeSqlOnFleetAppD1 } from '#server/utils/fleet-d1-remote'
import { fetchFleetDatabaseAppProxy } from '#server/utils/fleet-database-app-proxy'
import { queryFleetPostgresRows } from '#server/utils/fleet-database-pg'
import { resolveFleetDatabaseTarget } from '#server/utils/fleet-database-resolve'
import { formatPostgresTableName } from '#server/utils/fleet-database-studio'
import {
  assertFirstStatementOk,
  firstStatementRows,
  LIST_USER_TABLES_SQL,
  pickSqliteMasterTableName,
  shouldListFleetTable,
} from '#server/utils/fleet-d1-studio'

const querySchema = z.object({
  databaseName: z.string().min(1).max(128).optional(),
  databaseId: z.string().uuid().optional(),
  schemaName: z.string().min(1).max(63).optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await enforceRateLimit(event, 'fleet-database-tables', 60, 60_000)

  const appName = getRouterParam(event, 'name')
  if (!appName) throw createError({ statusCode: 400, message: 'Missing app name' })

  const query = await getValidatedQuery(event, querySchema.parse)
  const target = await resolveFleetDatabaseTarget(event, appName, {
    schemaName: query.schemaName,
  })

  try {
    if (target.backend === 'postgres') {
      const proxy = await fetchFleetDatabaseAppProxy<{
        ok: true
        backend: 'postgres'
        databaseId: null
        databaseName: string
        schemaName: string
        tables: string[]
        catalogTableCount: number
        internalTableCount: number
        hint?: string
      }>(target, {
        method: 'GET',
        path: '/tables',
        query: {
          schemaName: target.schemaName,
        },
      })

      if (proxy.ok) {
        return {
          ...proxy.data,
          app: appName,
        }
      }
      if (!proxy.canFallback) {
        throw createError({ statusCode: 502, message: proxy.message })
      }

      const rows = await queryFleetPostgresRows({
        connectionString: target.connectionString,
        sql: `
          SELECT table_schema, table_name
          FROM information_schema.tables
          WHERE table_type IN ('BASE TABLE', 'VIEW')
            AND table_schema = $1
          ORDER BY table_name
        `,
        params: [target.schemaName],
      })

      const tables = rows
        .map((row) =>
          formatPostgresTableName(
            String(row.table_schema ?? target.schemaName),
            String(row.table_name ?? ''),
          ),
        )
        .filter(Boolean)

      let hint: string | undefined
      if (tables.length === 0) {
        hint = `No tables or views were found in schema "${target.schemaName}".`
      }

      return {
        ok: true as const,
        app: appName,
        backend: 'postgres' as const,
        databaseId: null,
        databaseName: new URL(target.connectionString).pathname.replace(/^\/+/, '') || 'postgres',
        schemaName: target.schemaName,
        tables,
        catalogTableCount: tables.length,
        internalTableCount: 0,
        hint: hint ?? proxy.message,
      }
    }

    const out = await executeSqlOnFleetAppD1({
      accountId: target.accountId,
      apiToken: target.apiToken,
      appName,
      sql: LIST_USER_TABLES_SQL,
      databaseName: query.databaseName ?? target.app.d1DatabaseName ?? undefined,
      databaseId: query.databaseId,
    })
    assertFirstStatementOk(out.result, 'list tables')

    const rows = firstStatementRows(out.result)
    const catalogNames = rows
      .map((row) => pickSqliteMasterTableName(row))
      .filter((name): name is string => Boolean(name))
    const tables = catalogNames.filter((name) => shouldListFleetTable(name))
    const internalTableCount = catalogNames.filter((name) => !shouldListFleetTable(name)).length

    let hint: string | undefined
    if (tables.length === 0 && catalogNames.length === 0) {
      hint =
        'sqlite_master has no tables or views yet. Run remote D1 migrations (deploy CI or wrangler d1 execute --remote) for this database.'
    } else if (tables.length === 0 && internalTableCount > 0) {
      hint = `This D1 file only has internal/system tables (${internalTableCount} hidden, e.g. _cf_*). Your app schema is not on this remote database yet — apply migrations to ${out.databaseName}.`
    }

    return {
      ok: true as const,
      app: appName,
      backend: 'd1' as const,
      databaseId: out.databaseId,
      databaseName: out.databaseName,
      schemaName: null,
      tables,
      catalogTableCount: catalogNames.length,
      internalTableCount,
      hint,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw createError({ statusCode: 502, message: `Database table list failed: ${message}` })
  }
})
