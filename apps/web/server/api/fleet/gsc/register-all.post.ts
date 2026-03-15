import { GSC_SCOPES } from '#layer/server/utils/google'
import { getFleetApps } from '#server/data/fleet-registry'

/**
 * POST /api/fleet/gsc/register-all
 *
 * Batch-registers all fleet app domains in Google Search Console
 * using the service account. This uses the Sites API PUT method
 * which adds the site to the service account's GSC property list.
 *
 * Note: This doesn't verify ownership — it just claims the site.
 * Full verification requires DNS TXT records or HTML file verification.
 * However, service accounts with domain-level verification (via Google Workspace
 * or Cloud Identity) can programmatically claim sites.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const cronHeader = getHeader(event, 'x-internal-cron')
  if (!(config.cronSecret && cronHeader === config.cronSecret)) {
    await requireAdmin(event)
  }
  await enforceRateLimit(event, 'gsc-register', 5, 60_000)

  const apps = await getFleetApps(event)

  // Get access token for GSC
  const { getAccessToken } = await import('#layer/server/utils/google')
  const token = await getAccessToken(GSC_SCOPES)

  const results: {
    app: string
    url: string
    siteUrl: string
    status: 'registered' | 'failed'
    error?: string
  }[] = []

  for (const app of apps) {
    const hostname = new URL(app.url).hostname
    const siteUrl = `sc-domain:${hostname}`

    try {
      const response = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      )

      if (response.ok || response.status === 204) {
        results.push({ app: app.name, url: app.url, siteUrl, status: 'registered' })
      } else {
        const body = await response.text().catch(() => '')
        results.push({
          app: app.name,
          url: app.url,
          siteUrl,
          status: 'failed',
          error: `${response.status}: ${body.slice(0, 200)}`,
        })
      }
    } catch (err: unknown) {
      results.push({
        app: app.name,
        url: app.url,
        siteUrl,
        status: 'failed',
        error: (err as Error).message,
      })
    }
  }

  const registered = results.filter((r) => r.status === 'registered').length
  const failed = results.filter((r) => r.status === 'failed').length

  return {
    summary: { total: results.length, registered, failed },
    results,
  }
})
