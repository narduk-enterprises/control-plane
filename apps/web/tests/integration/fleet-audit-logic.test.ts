import { describe, expect, it } from 'vitest'
import type { FleetApp } from '../../server/database/schema'
import {
  buildAnalyticsProviderChecks,
  buildAuditChecks,
  buildSelfAuditSignalsFromConfig,
  extractAuditSignalsFromHtml,
} from '../../server/utils/fleet-audit'

function makeApp(overrides: Partial<FleetApp> = {}): FleetApp {
  return {
    name: 'example-app',
    url: 'https://example.com',
    dopplerProject: 'example-app',
    gaPropertyId: null,
    gaMeasurementId: null,
    posthogAppName: null,
    githubRepo: 'narduk-enterprises/example-app',
    forgejoRepo: 'narduk-enterprises/example-app',
    repoPrimary: 'github',
    isActive: true,
    createdAt: '2026-03-22T00:00:00.000Z',
    updatedAt: '2026-03-22T00:00:00.000Z',
    ...overrides,
  }
}

describe('fleet audit logic', () => {
  it('builds self-audit signals from runtime config values', () => {
    expect(
      buildSelfAuditSignalsFromConfig({
        appName: 'Narduk Control Plane',
        gaMeasurementId: 'G-MXPTRREXFV',
        posthogPublicKey: 'phc_test_123',
      }),
    ).toEqual({
      appName: 'Narduk Control Plane',
      gaMeasurementId: 'G-MXPTRREXFV',
      posthogPublicKey: 'phc_test_123',
      title: 'Narduk Control Plane Dashboard',
    })
  })

  it('creates a reconcile candidate for a registry mismatch', () => {
    const app = makeApp({ gaMeasurementId: 'G-OLDVALUE123' })
    const { reconcileCandidate } = buildAuditChecks(app, {
      appName: 'example-app',
      gaMeasurementId: 'G-NEWVALUE456',
      posthogPublicKey: 'phc_test_123',
      title: 'Example App',
    })

    expect(reconcileCandidate).toEqual({
      app: 'example-app',
      previousMeasurementId: 'G-OLDVALUE123',
      liveMeasurementId: 'G-NEWVALUE456',
    })
  })

  it('warns when an active app has no GA configured anywhere', () => {
    const app = makeApp({ gaPropertyId: '123456789', gaMeasurementId: null, isActive: true })
    const { checks } = buildAuditChecks(app, {
      appName: 'example-app',
      gaMeasurementId: null,
      posthogPublicKey: 'phc_test_123',
      title: 'Example App',
    })

    const gaCheck = checks.find((check) => check.name === 'GA Measurement ID')
    expect(gaCheck?.status).toBe('warning')
    expect(gaCheck?.message).toContain('Active app has no ga_measurement_id configured')
  })

  it('fails the GA4 provider check when the fleet registry is missing a property ID', () => {
    const checks = buildAnalyticsProviderChecks({
      ga: {
        status: 'missing_registry',
        source: 'none',
        stale: false,
        lastUpdatedAt: null,
        message: 'GA4: No property ID configured for bluebonnet-status-online.',
        metrics: null,
      },
      gsc: {
        status: 'healthy',
        source: 'live',
        stale: false,
        lastUpdatedAt: '2026-03-22T00:00:00.000Z',
        message: null,
        metrics: {
          totals: null,
          queries: [],
          devices: [],
          timeSeries: [],
          inspection: null,
          siteUrl: 'sc-domain:bluebonnetstatus.com',
          note: null,
        },
      },
    })

    const gaCheck = checks.find((check) => check.name === 'GA4 Provider Health')
    expect(gaCheck).toMatchObject({
      status: 'fail',
      actual: 'missing_registry',
    })
    expect(gaCheck?.message).toContain('No property ID configured')
  })

  it('fails the Search Console provider check when service-account access is missing', () => {
    const checks = buildAnalyticsProviderChecks({
      ga: {
        status: 'healthy',
        source: 'live',
        stale: false,
        lastUpdatedAt: '2026-03-22T00:00:00.000Z',
        message: null,
        metrics: null,
      },
      gsc: {
        status: 'access_denied',
        source: 'none',
        stale: false,
        lastUpdatedAt: null,
        message:
          "GSC: No access for 'sc-domain:lucysloomies.nard.uk' or 'https://lucysloomies.nard.uk/'.",
        metrics: null,
      },
    })

    const gscCheck = checks.find((check) => check.name === 'Search Console Provider Health')
    expect(gscCheck).toMatchObject({
      status: 'fail',
      actual: 'access_denied',
    })
    expect(gscCheck?.message).toContain('No access')
  })

  it('extracts audit signals from production HTML snippets', () => {
    const html = `
      <html>
        <head><title>Example App</title></head>
        <body>
          <script>
            window.__NUXT__ = {
              config: {
                appName: "Example App",
                gaMeasurementId: "G-TESTVALUE123",
                posthogPublicKey: "phc_test_123"
              }
            }
          </script>
        </body>
      </html>
    `

    expect(extractAuditSignalsFromHtml(html)).toEqual({
      appName: 'Example App',
      gaMeasurementId: 'G-TESTVALUE123',
      posthogPublicKey: 'phc_test_123',
      title: 'Example App',
    })
  })
})
