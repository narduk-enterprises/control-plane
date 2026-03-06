import { describe, it, expect } from 'vitest'
import { apiFetch, assertNot500, authIt, TEST_APP } from './helpers'

describe('Fleet Analytics — GA, GSC, PostHog', () => {
  // ── Google Analytics ───────────────────────────────────────────────
  describe('GET /api/fleet/ga/:app', () => {
    authIt('returns GA data or 503 if no property ID configured', async () => {
      const today = new Date().toISOString().split('T')[0]
      const res = await apiFetch(`/api/fleet/ga/${TEST_APP}?startDate=${today}&endDate=${today}`)
      assertNot500(res.status, `GET /api/fleet/ga/${TEST_APP}`)

      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('app', TEST_APP)
        expect(data).toHaveProperty('propertyId')
        expect(data).toHaveProperty('summary')
        expect(data).toHaveProperty('timeSeries')
        expect(data).toHaveProperty('startDate')
        expect(data).toHaveProperty('endDate')
      } else {
        // 503 = no GA config, 403 = no access, 404 = app not in cache
        expect([503, 403, 404]).toContain(res.status)
      }
    })

    authIt('returns 404 for non-existent app', async () => {
      const res = await apiFetch('/api/fleet/ga/nonexistent-app-xyz')
      expect(res.status).toBe(404)
    })
  })

  // ── Google Search Console ──────────────────────────────────────────
  describe('GET /api/fleet/gsc/:app', () => {
    authIt('returns GSC data or handled error', async () => {
      const res = await apiFetch(`/api/fleet/gsc/${TEST_APP}`)
      assertNot500(res.status, `GET /api/fleet/gsc/${TEST_APP}`)

      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('app', TEST_APP)
        expect(data).toHaveProperty('rows')
        expect(data).toHaveProperty('totals')
        expect(data).toHaveProperty('startDate')
        expect(data).toHaveProperty('endDate')
        expect(data).toHaveProperty('dimension')
      } else {
        expect([403, 404, 503]).toContain(res.status)
      }
    })

    authIt('returns 404 for non-existent app', async () => {
      const res = await apiFetch('/api/fleet/gsc/nonexistent-app-xyz')
      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/fleet/gsc/:app/series', () => {
    authIt('returns GSC time series data or handled error', async () => {
      const res = await apiFetch(`/api/fleet/gsc/${TEST_APP}/series`)
      assertNot500(res.status, `GET /api/fleet/gsc/${TEST_APP}/series`)

      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('app', TEST_APP)
        expect(data).toHaveProperty('timeSeries')
        expect(Array.isArray(data.timeSeries)).toBe(true)
      } else {
        expect([403, 404, 503]).toContain(res.status)
      }
    })
  })

  describe('GET /api/fleet/gsc/verify-test', () => {
    it('returns an object with success property', async () => {
      const res = await apiFetch('/api/fleet/gsc/verify-test')
      assertNot500(res.status, 'GET /api/fleet/gsc/verify-test')

      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('success')
      }
    })
  })

  // ── PostHog ────────────────────────────────────────────────────────
  describe('GET /api/fleet/posthog/:app', () => {
    authIt('returns PostHog data or 503 if not configured', async () => {
      const res = await apiFetch(`/api/fleet/posthog/${TEST_APP}`)
      assertNot500(res.status, `GET /api/fleet/posthog/${TEST_APP}`)

      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('app', TEST_APP)
        expect(data).toHaveProperty('summary')
        expect(data).toHaveProperty('startDate')
        expect(data).toHaveProperty('endDate')
      } else {
        // 503 = not configured, 403 = no access, 429 = rate limited, 404 = app not in cache
        expect([503, 403, 429, 404]).toContain(res.status)
      }
    })

    authIt('accepts summaryOnly parameter', async () => {
      const res = await apiFetch(`/api/fleet/posthog/${TEST_APP}?summaryOnly=true`)
      assertNot500(res.status, `GET /api/fleet/posthog/${TEST_APP}?summaryOnly=true`)

      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('summary')
        expect(data).not.toHaveProperty('topPages')
      }
    })

    authIt('returns 404 for non-existent app', async () => {
      const res = await apiFetch('/api/fleet/posthog/nonexistent-app-xyz')
      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/fleet/posthog/summary', () => {
    authIt('returns batch PostHog summary or error', async () => {
      const res = await apiFetch('/api/fleet/posthog/summary')

      if (res.status === 200) {
        const data = await res.json()
        expect(typeof data).toBe('object')
      } else {
        // 500 = batch query can fail, 503 = not configured, 429 = rate limited
        expect([500, 503, 403, 429]).toContain(res.status)
      }
    })
  })

  // ── Analytics Summary & Insights ───────────────────────────────────
  describe('GET /api/fleet/analytics/summary', () => {
    authIt('returns analytics summary with apps map', async () => {
      const res = await apiFetch('/api/fleet/analytics/summary')
      assertNot500(res.status, 'GET /api/fleet/analytics/summary')

      if (res.status === 200) {
        const data = await res.json()
        // withD1Cache wraps in { data, _meta } — unwrap
        const inner = data.data ?? data.value ?? data
        expect(inner).toHaveProperty('apps')
        expect(inner).toHaveProperty('startDate')
        expect(inner).toHaveProperty('endDate')
      }
    })
  })

  describe('GET /api/fleet/analytics/insights', () => {
    authIt('returns insights array', async () => {
      const res = await apiFetch('/api/fleet/analytics/insights')
      assertNot500(res.status, 'GET /api/fleet/analytics/insights')

      if (res.status === 200) {
        const data = await res.json()
        const inner = data.data ?? data.value ?? data
        expect(inner).toHaveProperty('insights')
        expect(Array.isArray(inner.insights)).toBe(true)
        expect(inner).toHaveProperty('startDate')
        expect(inner).toHaveProperty('endDate')
      }
    })
  })

  // ── Null field behavior (the original bug report) ──────────────────
  describe('Null gaPropertyId / posthogAppName handling', () => {
    authIt('GA returns error (not 500) for an app with null gaPropertyId', async () => {
      const listRes = await apiFetch('/api/fleet/apps?includeInactive=true')
      const apps = (await listRes.json()) as Array<{ name: string; gaPropertyId: string | null }>
      const nullGaApp = apps.find((a) => a.gaPropertyId === null)

      if (nullGaApp) {
        const gaRes = await apiFetch(`/api/fleet/ga/${nullGaApp.name}`)
        // 503 = no property ID configured, 404 = app not in cache
        expect([503, 404]).toContain(gaRes.status)
        assertNot500(gaRes.status, `GA for null gaPropertyId app: ${nullGaApp.name}`)
      } else {
        console.log('[INFO] All apps have gaPropertyId set — skipping null GA test')
      }
    })

    authIt('PostHog falls back to app.name when posthogAppName is null', async () => {
      const listRes = await apiFetch('/api/fleet/apps?includeInactive=true')
      const apps = (await listRes.json()) as Array<{
        name: string
        posthogAppName: string | null
        isActive: boolean
      }>
      const nullPhApp = apps.find((a) => a.posthogAppName === null && a.isActive)

      if (nullPhApp) {
        const phRes = await apiFetch(`/api/fleet/posthog/${nullPhApp.name}?summaryOnly=true`)
        assertNot500(phRes.status, `PostHog for app with null posthogAppName: ${nullPhApp.name}`)

        if (phRes.status === 200) {
          const data = await phRes.json()
          expect(data.app).toBe(nullPhApp.name)
        }
      } else {
        console.log('[INFO] All active apps have posthogAppName set — skipping null PostHog test')
      }
    })
  })
})
