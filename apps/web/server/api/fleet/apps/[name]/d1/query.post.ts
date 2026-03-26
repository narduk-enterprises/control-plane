import { z } from 'zod'
import { defineAdminMutation, readValidatedMutationBody } from '#layer/server/utils/mutation'
import { executeSqlOnFleetAppD1 } from '#server/utils/fleet-d1-remote'
import { resolveFleetD1Targets } from '#server/utils/fleet-d1-resolve'

const MAX_SQL_CHARS = 500_000

const bodySchema = z.object({
  sql: z.string().min(1).max(MAX_SQL_CHARS),
  params: z.array(z.string()).max(100).optional(),
  /** Default: `{appName}-db` */
  databaseName: z.string().min(1).max(128).optional(),
  databaseId: z.string().uuid().optional(),
})

/**
 * POST /api/fleet/apps/:name/d1/query
 *
 * Runs SQL against the fleet app's production D1 (Cloudflare API). Admin only.
 * Requires CLOUDFLARE_API_TOKEN with D1 edit permissions and CLOUDFLARE_ACCOUNT_ID.
 */
export default defineAdminMutation(
  {
    rateLimit: { namespace: 'fleet-d1-query', maxRequests: 30, windowMs: 60_000 },
    parseBody: async (event) => readValidatedMutationBody(event, bodySchema.parse),
  },
  async ({ event, body }) => {
    const appName = getRouterParam(event, 'name')
    if (!appName) throw createError({ statusCode: 400, message: 'Missing app name' })

    const { accountId, apiToken } = await resolveFleetD1Targets(event, appName)

    try {
      const out = await executeSqlOnFleetAppD1({
        accountId,
        apiToken,
        appName,
        sql: body.sql,
        params: body.params,
        databaseName: body.databaseName,
        databaseId: body.databaseId,
      })
      return {
        ok: true as const,
        app: appName,
        databaseId: out.databaseId,
        databaseName: out.databaseName,
        result: out.result,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw createError({
        statusCode: 502,
        message: `D1 query failed: ${message}`,
      })
    }
  },
)
