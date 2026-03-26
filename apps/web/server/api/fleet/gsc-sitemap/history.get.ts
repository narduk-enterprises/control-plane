import { desc } from 'drizzle-orm'
import { z } from 'zod'
import { requireAdmin } from '#layer/server/utils/auth'
import { gscSitemapSubmitLog, type GscSitemapSubmitLog } from '#server/database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const query = await getValidatedQuery(
    event,
    z.object({
      limit: z.coerce.number().int().min(1).max(500).default(100),
    }).parse,
  )

  const db = useDatabase(event)
  const rows: GscSitemapSubmitLog[] = await db
    .select()
    .from(gscSitemapSubmitLog)
    .orderBy(desc(gscSitemapSubmitLog.submittedAt))
    .limit(query.limit)
    .all()

  return rows.map((r) => ({
    id: r.id,
    app: r.app,
    submittedAt: r.submittedAt,
    ok: r.ok,
    trigger: r.trigger,
    sitemapUrl: r.sitemapUrl ?? null,
    gscProperty: r.gscProperty ?? null,
    message: r.message ?? null,
  }))
})
