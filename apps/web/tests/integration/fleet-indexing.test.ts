import { describe, it, expect } from 'vitest'
import { apiFetch, assertNot500, authIt, TEST_APP } from './helpers'

describe('Fleet Indexing & IndexNow', () => {
  // ── Indexing API Status ────────────────────────────────────────────
  describe('GET /api/fleet/indexing/status', () => {
    authIt('returns indexing metadata for a URL or 404', async () => {
      const res = await apiFetch(`/api/fleet/indexing/status?url=https://${TEST_APP}.nard.uk`)
      assertNot500(res.status, 'GET /api/fleet/indexing/status')

      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('url')
        expect(data).toHaveProperty('metadata')
      } else {
        expect([404, 403, 400]).toContain(res.status)
      }
    })

    authIt('returns 400 for missing url parameter', async () => {
      const res = await apiFetch('/api/fleet/indexing/status')
      expect(res.status).toBe(400)
    })
  })

  // ── Indexing Publish ───────────────────────────────────────────────
  describe('POST /api/fleet/indexing/publish', () => {
    authIt('handles URL indexing request or returns access error', async () => {
      const res = await apiFetch('/api/fleet/indexing/publish', {
        method: 'POST',
        body: JSON.stringify({
          url: `https://${TEST_APP}.nard.uk`,
          type: 'URL_UPDATED',
        }),
      })
      assertNot500(res.status, 'POST /api/fleet/indexing/publish')

      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('success', true)
        expect(data).toHaveProperty('url')
        expect(data).toHaveProperty('type', 'URL_UPDATED')
      } else {
        expect([400, 403, 401, 429]).toContain(res.status)
      }
    })

    authIt('returns 400 for invalid body', async () => {
      const res = await apiFetch('/api/fleet/indexing/publish', {
        method: 'POST',
        body: JSON.stringify({ url: 'not-a-url' }),
      })
      expect(res.status).toBe(400)
    })
  })

  // ── IndexNow ───────────────────────────────────────────────────────
  describe('POST /api/fleet/indexnow/:app', () => {
    authIt('submits IndexNow request for a fleet app', async () => {
      const res = await apiFetch(`/api/fleet/indexnow/${TEST_APP}`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      assertNot500(res.status, `POST /api/fleet/indexnow/${TEST_APP}`)

      if (res.status === 200) {
        const data = await res.json()
        expect(data).toHaveProperty('app', TEST_APP)
        expect(data).toHaveProperty('status')
        expect(data).toHaveProperty('targetUrl')
      }
    })

    authIt('returns 404 for non-existent app', async () => {
      const res = await apiFetch('/api/fleet/indexnow/nonexistent-app-xyz', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(404)
    })
  })

  // ── IndexNow Summary (no auth required) ────────────────────────────
  describe('GET /api/fleet/indexnow/summary', () => {
    it('returns aggregate IndexNow stats', async () => {
      const res = await apiFetch('/api/fleet/indexnow/summary')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('totalSubmissions')
      expect(data).toHaveProperty('appsWithIndexnow')
      expect(data).toHaveProperty('totalFleetSize')
      expect(typeof data.totalSubmissions).toBe('number')
      expect(typeof data.appsWithIndexnow).toBe('number')
      expect(typeof data.totalFleetSize).toBe('number')
    })
  })
})
