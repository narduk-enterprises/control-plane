import { desc } from 'drizzle-orm'
import { z } from 'zod'
import { requireAdmin } from '#layer/server/utils/auth'
import { indexnowPingLog, type IndexnowPingLog } from '#server/database/schema'

/**
 * GET /api/fleet/indexnow/history
 * Recent fleet IndexNow proxy attempts (success and failure), newest first.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const query = await getValidatedQuery(
    event,
    z.object({
      limit: z.coerce.number().int().min(1).max(500).default(100),
    }).parse,
  )

  const db = useDatabase(event)
  const rows: IndexnowPingLog[] = await db
    .select()
    .from(indexnowPingLog)
    .orderBy(desc(indexnowPingLog.pingedAt))
    .limit(query.limit)
    .all()

  return rows.map((r) => ({
    id: r.id,
    app: r.app,
    pingedAt: r.pingedAt,
    ok: r.ok,
    downstreamStatus: r.downstreamStatus ?? null,
    urlCount: r.urlCount ?? null,
    targetUrl: r.targetUrl ?? null,
    message: r.message ?? null,
  }))
})
