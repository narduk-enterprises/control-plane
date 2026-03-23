import { z } from 'zod'
import { readBody } from 'h3'
import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { getFleetAppByName } from '#server/data/fleet-registry'
import { submitFleetAppGscSitemap } from '#server/utils/fleet-gsc-sitemap'

const bodySchema = z.object({ force: z.boolean().optional().default(true) })

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await enforceRateLimit(event, 'fleet-gsc-sitemap', 20, 60_000)

  const appSlug = getRouterParam(event, 'app')
  if (!appSlug) throw createError({ statusCode: 400, message: 'Missing app' })

  const app = await getFleetAppByName(event, appSlug)
  if (!app) throw createError({ statusCode: 404, message: 'App not found' })

  const raw = await readBody(event).catch(() => ({}))
  const parsed = bodySchema.safeParse(raw)
  const force = parsed.success ? parsed.data.force : true

  const result = await submitFleetAppGscSitemap(event, app, { force, trigger: 'manual' })

  if (!result.ok) {
    throw createError({
      statusCode:
        result.statusCode && result.statusCode >= 400 && result.statusCode < 600
          ? result.statusCode
          : 502,
      message: result.message,
      data: { app: result.app, sitemapUrl: result.sitemapUrl },
    })
  }

  return {
    app: result.app,
    action: result.action,
    gscSiteUrl: result.gscSiteUrl,
    sitemapUrl: result.sitemapUrl,
    fingerprint: result.fingerprint,
  }
})
