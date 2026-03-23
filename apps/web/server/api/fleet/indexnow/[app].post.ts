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
  const appName = app.name

  const body = await readBody(event).catch(() => ({}))
  const parsed = bodySchema.safeParse(body)
  const payload = parsed.success ? parsed.data : {}

  const targetUrl = `${app.url.replace(/\/$/, '')}/api/indexnow/submit`
  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify(payload),
  })

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  const downstreamMessage = typeof data.message === 'string' ? data.message : undefined
  const message =
    res.status === 404
      ? 'Fleet app does not expose /api/indexnow/submit. Ensure the app uses the Narduk template layer or implements this endpoint.'
      : undefined

  const db = useDatabase(event)
  const { indexnowPingLog: pingTable, appStatus: appStatusTable } =
    await import('#server/database/schema')
  const { eq, sql } = await import('drizzle-orm')

  const pingedAt = new Date().toISOString()
  const logId = crypto.randomUUID()

  async function writePingLog(params: {
    ok: boolean
    downstreamStatus: number
    urlCount: number | null
    message: string | null
  }) {
    const msg =
      params.message && params.message.length > 500
        ? `${params.message.slice(0, 497)}…`
        : params.message
    await db.insert(pingTable).values({
      id: logId,
      app: appName,
      pingedAt,
      ok: params.ok,
      downstreamStatus: params.downstreamStatus,
      urlCount: params.urlCount,
      targetUrl,
      message: msg,
    })
  }

  if (!res.ok) {
    const errMsg =
      message ?? downstreamMessage ?? `Target /api/indexnow/submit returned HTTP ${res.status}`
    await writePingLog({
      ok: false,
      downstreamStatus: res.status,
      urlCount: null,
      message: errMsg,
    })
    throw createError({
      statusCode: res.status === 404 ? 404 : 502,
      message: errMsg,
      data: { app: appName, targetUrl, status: res.status, response: data },
    })
  }

  await db
    .update(appStatusTable)
    .set({
      indexnowLastSubmission: pingedAt,
      indexnowTotalSubmissions: sql`${appStatusTable.indexnowTotalSubmissions} + 1`,
      indexnowLastSubmittedCount: (data.submitted as number) ?? 0,
    })
    .where(eq(appStatusTable.app, appName))

  await writePingLog({
    ok: true,
    downstreamStatus: res.status,
    urlCount: (data.submitted as number) ?? 0,
    message: null,
  })

  return { app: appName, status: res.status, targetUrl, response: data, message }
})
