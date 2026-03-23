import { z } from 'zod'
import { defineAdminMutation, withOptionalValidatedBody } from '#layer/server/utils/mutation'
import { getFleetAppByName } from '#server/data/fleet-registry'
import { submitFleetAppGscSitemap } from '#server/utils/fleet-gsc-sitemap'

const bodySchema = z.object({ force: z.boolean().optional().default(true) })

export default defineAdminMutation(
  {
    rateLimit: { namespace: 'fleet-gsc-sitemap', maxRequests: 20, windowMs: 60_000 },
    parseBody: withOptionalValidatedBody((raw) => {
      const parsed = bodySchema.safeParse(raw)
      return { force: parsed.success ? parsed.data.force : true }
    }, {}),
  },
  async ({ event, body }) => {
    const appSlug = getRouterParam(event, 'app')
    if (!appSlug) throw createError({ statusCode: 400, message: 'Missing app' })

    const app = await getFleetAppByName(event, appSlug)
    if (!app) throw createError({ statusCode: 404, message: 'App not found' })

    const result = await submitFleetAppGscSitemap(event, app, {
      force: body.force,
      trigger: 'manual',
    })

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
  },
)
