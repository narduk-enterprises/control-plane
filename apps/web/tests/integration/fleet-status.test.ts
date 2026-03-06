import { describe, it, expect } from 'vitest'
import { apiFetch, assertNot500, authIt, TEST_APP } from './helpers'

describe('Fleet Status & Monitoring', () => {
  // ── Status (no auth required on GET) ───────────────────────────────
  describe('GET /api/fleet/status', () => {
    it('returns an array of app statuses', async () => {
      const res = await apiFetch('/api/fleet/status')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(Array.isArray(data)).toBe(true)
      if (data.length > 0) {
        const first = data[0]
        expect(first).toHaveProperty('app')
        expect(first).toHaveProperty('url')
        expect(first).toHaveProperty('status')
        expect(first).toHaveProperty('checkedAt')
        expect(['up', 'down']).toContain(first.status)
      }
    })
  })

  describe('POST /api/fleet/status/refresh', () => {
    authIt('triggers a full fleet status refresh', async () => {
      const res = await apiFetch('/api/fleet/status/refresh', { method: 'POST' })
      assertNot500(res.status, 'POST /api/fleet/status/refresh')

      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('ok', true)
        expect(data).toHaveProperty('checked')
        expect(data).toHaveProperty('statuses')
        expect(Array.isArray(data.statuses)).toBe(true)
      }
    })
  })

  describe('POST /api/fleet/status/:app/refresh', () => {
    authIt('triggers a single-app status refresh', async () => {
      const res = await apiFetch(`/api/fleet/status/${TEST_APP}/refresh`, { method: 'POST' })
      assertNot500(res.status, `POST /api/fleet/status/${TEST_APP}/refresh`)

      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('ok', true)
        expect(data).toHaveProperty('status')
        expect(data.status).toHaveProperty('app', TEST_APP)
        expect(['up', 'down']).toContain(data.status.status)
      }
    })

    authIt('returns 404 for non-existent app', async () => {
      const res = await apiFetch('/api/fleet/status/nonexistent-app-xyz/refresh', {
        method: 'POST',
      })
      expect(res.status).toBe(404)
    })
  })

  // ── Sitemap Analysis ───────────────────────────────────────────────
  describe('GET /api/fleet/sitemap-analysis/:app', () => {
    authIt('returns sitemap summary for a fleet app', async () => {
      const res = await apiFetch(`/api/fleet/sitemap-analysis/${TEST_APP}`)
      assertNot500(res.status, `GET /api/fleet/sitemap-analysis/${TEST_APP}`)

      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('totalUrls')
        expect(data).toHaveProperty('sitemapUrl')
        expect(data).toHaveProperty('baseUrl')
        expect(data).toHaveProperty('urls')
        expect(Array.isArray(data.urls)).toBe(true)
        expect(typeof data.totalUrls).toBe('number')
      } else {
        expect([502, 404]).toContain(res.status)
      }
    })

    authIt('returns 404 for non-existent app', async () => {
      const res = await apiFetch('/api/fleet/sitemap-analysis/nonexistent-app-xyz')
      expect(res.status).toBe(404)
    })
  })

  // ── Audit ──────────────────────────────────────────────────────────
  describe('POST /api/fleet/audit', () => {
    authIt('returns array of audit results for all fleet apps', async () => {
      const res = await apiFetch('/api/fleet/audit', { method: 'POST' })
      assertNot500(res.status, 'POST /api/fleet/audit')

      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
        expect(data.length).toBeGreaterThan(0)

        const first = data[0]
        expect(first).toHaveProperty('app')
        expect(first).toHaveProperty('url')
        expect(first).toHaveProperty('checks')
        expect(Array.isArray(first.checks)).toBe(true)

        if (first.checks.length > 0) {
          const check = first.checks[0]
          expect(check).toHaveProperty('name')
          expect(check).toHaveProperty('status')
          expect(['pass', 'fail', 'warning', 'skipped']).toContain(check.status)
        }
      }
    })
  })
})
