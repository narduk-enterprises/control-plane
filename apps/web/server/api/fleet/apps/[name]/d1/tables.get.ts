import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { executeSqlOnFleetAppD1 } from '#server/utils/fleet-d1-remote'
import { resolveFleetD1Targets } from '#server/utils/fleet-d1-resolve'
import {
  assertFirstStatementOk,
  firstStatementRows,
  LIST_USER_TABLES_SQL,
  pickSqliteMasterTableName,
  shouldListFleetTable,
} from '#server/utils/fleet-d1-studio'
import { z } from 'zod'

const querySchema = z.object({
  databaseName: z.string().min(1).max(128).optional(),
  databaseId: z.string().uuid().optional(),
})

/**
 * GET /api/fleet/apps/:name/d1/tables
 * List user tables and views (studio sidebar).
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await enforceRateLimit(event, 'fleet-d1-tables', 60, 60_000)

  const appName = getRouterParam(event, 'name')
  if (!appName) throw createError({ statusCode: 400, message: 'Missing app name' })

  const q = await getValidatedQuery(event, querySchema.parse)
  const { accountId, apiToken, d1DatabaseName } = await resolveFleetD1Targets(event, appName)

  try {
    const out = await executeSqlOnFleetAppD1({
      accountId,
      apiToken,
      appName,
      sql: LIST_USER_TABLES_SQL,
      databaseName: q.databaseName ?? d1DatabaseName ?? undefined,
      databaseId: q.databaseId,
    })
    assertFirstStatementOk(out.result, 'list tables')
    const rows = firstStatementRows(out.result)
    const catalogNames = rows
      .map((r) => pickSqliteMasterTableName(r))
      .filter((n): n is string => Boolean(n))
    const tables = catalogNames.filter((n) => shouldListFleetTable(n))
    const internalTableCount = catalogNames.filter((n) => !shouldListFleetTable(n)).length

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
      databaseId: out.databaseId,
      databaseName: out.databaseName,
      tables,
      catalogTableCount: catalogNames.length,
      internalTableCount,
      hint,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw createError({ statusCode: 502, message: `D1 list tables failed: ${message}` })
  }
})
