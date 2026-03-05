import { z } from 'zod'
import { readBody } from 'h3'
import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { getFleetAppByName } from '#server/data/fleet-registry'

const bodySchema = z.object({ urls: z.array(z.string().url()).optional() })

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await enforceRateLimit(event, 'fleet-indexnow', 10, 60_000)

  const appSlug = getRouterParam(event, 'app')
  if (!appSlug) throw createError({ statusCode: 400, message: 'Missing app' })

  const app = await getFleetAppByName(event, appSlug)
  if (!app) throw createError({ statusCode: 404, message: 'App not found' })

  const body = await readBody(event).catch(() => ({}))
  const parsed = bodySchema.safeParse(body)
  const payload = parsed.success ? parsed.data : {}

  const targetUrl = `${app.url.replace(/\/$/, '')}/api/indexnow/submit`
  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({})) as Record<string, unknown>
  const message =
    res.status === 404
      ? 'Fleet app does not expose /api/indexnow/submit. Ensure the app uses the Narduk template layer or implements this endpoint.'
      : undefined

  // Record stats if successful
  if (res.ok) {
    const db = useDatabase(event)
    const { eq, sql } = await import('drizzle-orm')
    const appStatusTable = (await import('#server/database/schema')).appStatus

    await db.update(appStatusTable)
      .set({
        indexnowLastSubmission: new Date().toISOString(),
        indexnowTotalSubmissions: sql`${appStatusTable.indexnowTotalSubmissions} + 1`,
        indexnowLastSubmittedCount: (data.submitted as number) ?? 0,
      })
      .where(eq(appStatusTable.app, app.name))
  }

  return { app: app.name, status: res.status, targetUrl, response: data, message }
})
