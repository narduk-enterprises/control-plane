import { z } from 'zod'
import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { executeSqlOnFleetAppD1 } from '#server/utils/fleet-d1-remote'
import { fetchFleetDatabaseAppProxy } from '#server/utils/fleet-database-app-proxy'
import { queryFleetPostgresRows, queryFleetPostgresScalar } from '#server/utils/fleet-database-pg'
import { resolveFleetDatabaseTarget } from '#server/utils/fleet-database-resolve'
import {
  mapPostgresColumnRow,
  parseFleetTableRef,
  quoteQualifiedTableRef,
} from '#server/utils/fleet-database-studio'
import {
  assertFirstStatementOk,
  firstStatementRows,
  firstStatementScalar,
  getRowValue,
} from '#server/utils/fleet-d1-studio'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).max(10_000_000).optional().default(0),
  databaseName: z.string().min(1).max(128).optional(),
  databaseId: z.string().uuid().optional(),
  schemaName: z.string().min(1).max(63).optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await enforceRateLimit(event, 'fleet-database-table-rows', 120, 60_000)

  const appName = getRouterParam(event, 'name')
  const table = getRouterParam(event, 'table')
  if (!appName) throw createError({ statusCode: 400, message: 'Missing app name' })
  if (!table) throw createError({ statusCode: 400, message: 'Missing table name' })

  const decodedTable = decodeURIComponent(table)
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
        table: string
        columns: Array<{
          cid: number
          name: string
          type: string
          notnull: number
          dflt_value: unknown
          pk: number
        }>
        rows: Record<string, unknown>[]
        total: number
        limit: number
        offset: number
      }>(target, {
        method: 'GET',
        path: `/tables/${encodeURIComponent(decodedTable)}`,
        query: {
          schemaName: target.schemaName,
          limit: query.limit,
          offset: query.offset,
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

      const parsed = parseFleetTableRef('postgres', decodedTable, target.schemaName)
      const tableRef = quoteQualifiedTableRef('postgres', decodedTable, target.schemaName)

      const columns = (
        await queryFleetPostgresRows({
          connectionString: target.connectionString,
          sql: `
            WITH pk AS (
              SELECT
                a.attname AS column_name,
                row_number() OVER (ORDER BY ord.ordinality) AS pk_position
              FROM pg_class t
              JOIN pg_namespace n ON n.oid = t.relnamespace
              JOIN pg_index i ON i.indrelid = t.oid AND i.indisprimary
              JOIN unnest(i.indkey) WITH ORDINALITY ord(attnum, ordinality) ON true
              JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ord.attnum
              WHERE n.nspname = $1
                AND t.relname = $2
            )
            SELECT
              a.attnum - 1 AS cid,
              a.attname AS name,
              pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
              CASE WHEN a.attnotnull THEN 1 ELSE 0 END AS notnull,
              pg_get_expr(ad.adbin, ad.adrelid) AS dflt_value,
              COALESCE(pk.pk_position, 0) AS pk
            FROM pg_class t
            JOIN pg_namespace n ON n.oid = t.relnamespace
            JOIN pg_attribute a ON a.attrelid = t.oid
            LEFT JOIN pg_attrdef ad ON ad.adrelid = t.oid AND ad.adnum = a.attnum
            LEFT JOIN pk ON pk.column_name = a.attname
            WHERE n.nspname = $1
              AND t.relname = $2
              AND a.attnum > 0
              AND NOT a.attisdropped
            ORDER BY a.attnum
          `,
          params: [parsed.schema, parsed.table],
        })
      ).map(mapPostgresColumnRow)

      if (columns.length === 0) {
        throw createError({
          statusCode: 404,
          statusMessage: `Table or view '${parsed.displayName}' not found.`,
        })
      }

      const total = await queryFleetPostgresScalar(
        target.connectionString,
        `SELECT COUNT(*) AS c FROM ${tableRef.quoted}`,
      )
      const rows = await queryFleetPostgresRows({
        connectionString: target.connectionString,
        sql: `SELECT * FROM ${tableRef.quoted} LIMIT ${query.limit} OFFSET ${query.offset}`,
      })

      return {
        ok: true as const,
        app: appName,
        backend: 'postgres' as const,
        databaseId: null,
        databaseName: new URL(target.connectionString).pathname.replace(/^\/+/, '') || 'postgres',
        schemaName: parsed.schema,
        table: parsed.displayName,
        columns,
        rows,
        total,
        limit: query.limit,
        offset: query.offset,
      }
    }

    const tableRef = quoteQualifiedTableRef('d1', decodedTable)
    const pragmaSql = `PRAGMA table_info(${tableRef.quoted})`
    const countSql = `SELECT COUNT(*) AS c FROM ${tableRef.quoted}`
    const dataSql = `SELECT * FROM ${tableRef.quoted} LIMIT ${query.limit} OFFSET ${query.offset}`

    const bind = {
      accountId: target.accountId,
      apiToken: target.apiToken,
      appName,
      databaseName: query.databaseName ?? target.app.d1DatabaseName ?? undefined,
      databaseId: query.databaseId,
    }

    const pragmaOut = await executeSqlOnFleetAppD1({ ...bind, sql: pragmaSql })
    assertFirstStatementOk(pragmaOut.result, 'PRAGMA table_info')
    const columns = firstStatementRows(pragmaOut.result).map((row) => ({
      cid: Number(getRowValue(row, 'cid') ?? 0),
      name: String(getRowValue(row, 'name') ?? ''),
      type: String(getRowValue(row, 'type') ?? ''),
      notnull: Number(getRowValue(row, 'notnull') ?? 0),
      dflt_value: getRowValue(row, 'dflt_value') ?? null,
      pk: Number(getRowValue(row, 'pk') ?? 0),
    }))

    if (columns.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: `Table or view '${decodedTable}' not found.`,
      })
    }

    const countOut = await executeSqlOnFleetAppD1({ ...bind, sql: countSql })
    assertFirstStatementOk(countOut.result, 'COUNT')
    const total = firstStatementScalar(countOut.result, 'c')

    const dataOut = await executeSqlOnFleetAppD1({ ...bind, sql: dataSql })
    assertFirstStatementOk(dataOut.result, 'SELECT')
    const rows = firstStatementRows(dataOut.result)

    return {
      ok: true as const,
      app: appName,
      backend: 'd1' as const,
      databaseId: dataOut.databaseId,
      databaseName: dataOut.databaseName,
      schemaName: null,
      table: decodedTable,
      columns,
      rows,
      total,
      limit: query.limit,
      offset: query.offset,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    const message = error instanceof Error ? error.message : String(error)
    throw createError({ statusCode: 502, message: `Database table browse failed: ${message}` })
  }
})
