import { describe, it, expect } from 'vitest'
import { apiFetch, anonFetch, assertNot500 } from './helpers'

describe('Auth, GitHub & Users', () => {
  // ── GitHub Repos ───────────────────────────────────────────────────
  describe('GET /api/github/repos', () => {
    it('returns array of repos or auth error', async () => {
      const res = await apiFetch('/api/github/repos')
      assertNot500(res.status, 'GET /api/github/repos')

      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)

        if (data.length > 0) {
          const repo = data[0]
          expect(repo).toHaveProperty('name')
          expect(repo).toHaveProperty('fullName')
          expect(repo).toHaveProperty('url')
          expect(repo).toHaveProperty('updatedAt')
        }
      } else {
        expect([401, 403, 503]).toContain(res.status)
      }
    })

    it('supports force cache bypass', async () => {
      const res = await apiFetch('/api/github/repos?force=true')
      assertNot500(res.status, 'GET /api/github/repos?force=true')
      expect([200, 401, 403, 503]).toContain(res.status)
    })
  })

  // ── Users ──────────────────────────────────────────────────────────
  describe('GET /api/users', () => {
    it('returns array of users', async () => {
      const res = await apiFetch('/api/users')
      assertNot500(res.status, 'GET /api/users')

      if (res.status === 200) {
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
      } else {
        expect([401, 403]).toContain(res.status)
      }
    })
  })

  // ── Auth Guards (unauthenticated) ──────────────────────────────────
  describe('Auth Guards — unauthenticated requests', () => {
    const adminEndpoints = [
      { method: 'GET', path: '/api/fleet/apps' },
      { method: 'POST', path: '/api/fleet/apps' },
      { method: 'POST', path: '/api/fleet/audit' },
      { method: 'POST', path: '/api/fleet/status/refresh' },
      { method: 'GET', path: '/api/fleet/ga/neon-sewer-raid' },
      { method: 'GET', path: '/api/fleet/gsc/neon-sewer-raid' },
      { method: 'GET', path: '/api/fleet/posthog/neon-sewer-raid' },
      { method: 'GET', path: '/api/fleet/posthog/summary' },
      { method: 'GET', path: '/api/fleet/analytics/summary' },
      { method: 'GET', path: '/api/fleet/analytics/insights' },
      { method: 'POST', path: '/api/fleet/indexing/publish' },
      { method: 'POST', path: '/api/fleet/indexnow/neon-sewer-raid' },
      { method: 'POST', path: '/api/fleet/gsc-sitemap/neon-sewer-raid' },
      { method: 'GET', path: '/api/fleet/gsc-sitemap/history' },
      { method: 'GET', path: '/api/fleet/sitemap-analysis/neon-sewer-raid' },
    ]

    for (const { method, path } of adminEndpoints) {
      it(`${method} ${path} rejects unauthenticated requests`, async () => {
        const res = await anonFetch(path, { method })
        // POST routes may return 403 (CSRF) before auth; GET routes return 401
        expect([401, 403]).toContain(res.status)
      })
    }
  })
})
