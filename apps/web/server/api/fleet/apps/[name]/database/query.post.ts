import { z } from 'zod'
import { defineAdminMutation, readValidatedMutationBody } from '#layer/server/utils/mutation'
import { executeSqlOnFleetAppD1 } from '#server/utils/fleet-d1-remote'
import { fetchFleetDatabaseAppProxy } from '#server/utils/fleet-database-app-proxy'
import { executeSqlOnFleetAppPostgres } from '#server/utils/fleet-database-pg'
import { resolveFleetDatabaseTarget } from '#server/utils/fleet-database-resolve'

const MAX_SQL_CHARS = 500_000

const bodySchema = z.object({
  sql: z.string().min(1).max(MAX_SQL_CHARS),
  params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).max(100).optional(),
  databaseName: z.string().min(1).max(128).optional(),
  databaseId: z.string().uuid().optional(),
})

export default defineAdminMutation(
  {
    rateLimit: { namespace: 'fleet-database-query', maxRequests: 30, windowMs: 60_000 },
    parseBody: async (event) => readValidatedMutationBody(event, bodySchema.parse),
  },
  async ({ event, body }) => {
    const appName = getRouterParam(event, 'name')
    if (!appName) throw createError({ statusCode: 400, message: 'Missing app name' })

    const target = await resolveFleetDatabaseTarget(event, appName)

    try {
      if (target.backend === 'postgres') {
        const proxy = await fetchFleetDatabaseAppProxy<{
          ok: true
          backend: 'postgres'
          databaseId: null
          databaseName: string
          schemaName: string
          result: unknown[]
        }>(target, {
          method: 'POST',
          path: '/query',
          body: {
            sql: body.sql,
            params: body.params,
          },
        })

        if (proxy.ok) {
          return {
            ...proxy.data,
            app: appName,
          }
        }
        if (!proxy.canFallback) {
          throw createError({
            statusCode: proxy.statusCode ?? 502,
            message: proxy.message,
          })
        }

        const out = await executeSqlOnFleetAppPostgres({
          connectionString: target.connectionString,
          sql: body.sql,
          params: body.params,
        })
        return {
          ok: true as const,
          app: appName,
          backend: 'postgres' as const,
          databaseId: null,
          databaseName: out.databaseName,
          schemaName: target.schemaName,
          result: out.result,
        }
      }

      const out = await executeSqlOnFleetAppD1({
        accountId: target.accountId,
        apiToken: target.apiToken,
        appName,
        sql: body.sql,
        params: body.params?.map((value) => (value === null ? '' : String(value))),
        databaseName: body.databaseName,
        databaseId: body.databaseId,
      })

      return {
        ok: true as const,
        app: appName,
        backend: 'd1' as const,
        databaseId: out.databaseId,
        databaseName: out.databaseName,
        schemaName: null,
        result: out.result,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw createError({
        statusCode: 502,
        message: `Database query failed: ${message}`,
      })
    }
  },
)
