import { requireAdmin } from '#layer/server/utils/auth'
import { getFleetApps } from '#server/data/fleet-registry'

interface AuditCheck {
  name: string
  status: 'pass' | 'fail' | 'warning' | 'skipped'
  expected: string | null
  actual: string | null
  message: string
}

interface AuditResult {
  app: string
  url: string
  checks: AuditCheck[]
  fetchError?: string
}

/**
 * POST /api/fleet/audit
 *
 * Fetches the live HTML of each fleet app in parallel and extracts PostHog and GA
 * configuration from the serialized Nuxt runtime config payload (window.__NUXT__).
 * Compares against the fleet registry values and returns structured pass/fail/warning results.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const apps = await getFleetApps(event)

  // Audit all apps in parallel — eliminates serial latency stacking across fleet
  const results = await Promise.all(
    // eslint-disable-next-line nuxt-guardrails/no-map-async-in-server
    apps.map(async (app): Promise<AuditResult> => {
      let html = ''

      // 1. Fetch the app's production HTML
      try {
        const res = await fetch(app.url, {
          headers: { 'User-Agent': 'NardukControlPlane-Auditor/1.0' },
          redirect: 'follow',
          signal: AbortSignal.timeout(15_000),
        })
        if (!res.ok) {
          return {
            app: app.name,
            url: app.url,
            checks: [],
            fetchError: `HTTP ${res.status} ${res.statusText}`,
          }
        }
        html = await res.text()
      } catch (err) {
        return {
          app: app.name,
          url: app.url,
          checks: [],
          fetchError: err instanceof Error ? err.message : String(err),
        }
      }

      const checks: AuditCheck[] = []

      // 2. Extract PostHog API key from serialized Nuxt runtime config.
      // posthog.init() is called client-side only; the key is always present
      // in the SSR'd window.__NUXT__.config.public payload.
      const actualPhKey =
        html.match(/posthogPublicKey["']?\s*[:=]\s*["']([^"']+)["']/i)?.[1] ?? null
      checks.push({
        name: 'PostHog API Key',
        status: actualPhKey ? 'pass' : 'warning',
        expected: null,
        actual: actualPhKey,
        message: actualPhKey
          ? `Found PostHog key: ${actualPhKey.slice(0, 12)}...`
          : 'No posthogPublicKey found in serialized runtime config',
      })

      // 3. Check PostHog app identity — informational only.
      // Since PostHog now uses $host for filtering (not appName), we only verify
      // that appName is present in the runtime config. Display-name vs slug
      // mismatches (e.g. "Enigma Box" vs "enigma-box") are not actionable.
      const actualAppName = html.match(/appName["']?\s*[:=]\s*["']([^"']+)["']/i)?.[1] ?? null
      checks.push({
        name: 'PostHog App Name',
        status: actualAppName ? 'pass' : 'warning',
        expected: null,
        actual: actualAppName,
        message: actualAppName
          ? `appName: "${actualAppName}"`
          : 'appName not found in serialized runtime config',
      })

      // 4. Extract GA Measurement ID (G-XXXXXXXX) and compare to ga_measurement_id in registry.
      // Note: ga_property_id is the numeric GA4 Property ID used for the Reporting API — different field.
      const actualGaId =
        html.match(/gaMeasurementId["']?\s*[:=]\s*["'](G-[A-Z0-9]+)["']/i)?.[1] ?? null
      const expectedGaId = app.gaMeasurementId // G-XXXXXXXX from registry

      if (expectedGaId) {
        checks.push({
          name: 'GA Measurement ID',
          status: actualGaId === expectedGaId ? 'pass' : actualGaId ? 'fail' : 'warning',
          expected: expectedGaId,
          actual: actualGaId,
          message:
            actualGaId === expectedGaId
              ? 'Matches fleet registry'
              : actualGaId
                ? `Mismatch: expected "${expectedGaId}", got "${actualGaId}"`
                : `Expected "${expectedGaId}" but not found — redeploy app to pick up GA_MEASUREMENT_ID`,
        })
      } else {
        checks.push({
          name: 'GA Measurement ID',
          status: actualGaId ? 'warning' : 'skipped',
          expected: null,
          actual: actualGaId,
          message:
            !expectedGaId && actualGaId
              ? `Found "${actualGaId}" on site but fleet registry has no ga_measurement_id set`
              : 'No ga_measurement_id configured in fleet registry',
        })
      }

      // 5. Page title — informational
      const appNameInTitle = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null
      checks.push({
        name: 'Page Title',
        status: appNameInTitle ? 'pass' : 'warning',
        expected: null,
        actual: appNameInTitle,
        message: appNameInTitle ? `Title: "${appNameInTitle}"` : 'No <title> tag found',
      })

      return { app: app.name, url: app.url, checks }
    }),
  )

  // Return sorted by app name for stable UI ordering
  return results.sort((a, b) => a.app.localeCompare(b.app))
})
