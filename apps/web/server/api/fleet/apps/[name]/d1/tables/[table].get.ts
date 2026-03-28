import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { executeSqlOnFleetAppD1 } from '#server/utils/fleet-d1-remote'
import { resolveFleetD1Targets } from '#server/utils/fleet-d1-resolve'
import {
  assertFirstStatementOk,
  assertFleetD1TableName,
  firstStatementRows,
  firstStatementScalar,
  getRowValue,
  quoteSqliteIdent,
} from '#server/utils/fleet-d1-studio'
import { z } from 'zod'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).max(10_000_000).optional().default(0),
  databaseName: z.string().min(1).max(128).optional(),
  databaseId: z.string().uuid().optional(),
})

/**
 * GET /api/fleet/apps/:name/d1/tables/:table
 * Column metadata + paginated rows (studio grid).
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await enforceRateLimit(event, 'fleet-d1-table-rows', 120, 60_000)

  const appName = getRouterParam(event, 'name')
  const table = getRouterParam(event, 'table')
  if (!appName) throw createError({ statusCode: 400, message: 'Missing app name' })
  if (!table) throw createError({ statusCode: 400, message: 'Missing table name' })

  const decodedTable = decodeURIComponent(table)
  assertFleetD1TableName(decodedTable)

  const q = await getValidatedQuery(event, querySchema.parse)
  const { accountId, apiToken, d1DatabaseName } = await resolveFleetD1Targets(event, appName)

  const ident = quoteSqliteIdent(decodedTable)
  const pragmaSql = `PRAGMA table_info(${ident})`
  const countSql = `SELECT COUNT(*) AS c FROM ${ident}`
  const dataSql = `SELECT * FROM ${ident} LIMIT ${q.limit} OFFSET ${q.offset}`

  const bind = {
    accountId,
    apiToken,
    appName,
    databaseName: q.databaseName ?? d1DatabaseName ?? undefined,
    databaseId: q.databaseId,
  }

  try {
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
      databaseId: dataOut.databaseId,
      databaseName: dataOut.databaseName,
      table: decodedTable,
      columns,
      rows,
      total,
      limit: q.limit,
      offset: q.offset,
    }
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    const message = err instanceof Error ? err.message : String(err)
    throw createError({ statusCode: 502, message: `D1 table browse failed: ${message}` })
  }
})
