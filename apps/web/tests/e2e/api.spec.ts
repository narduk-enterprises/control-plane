import { test, expect } from '@playwright/test'

/**
 * API Integration Tests for Control Plane Endpoints.
 * These tests run against a live local server (http://localhost:3000).
 *
 * NOTE: These tests are designed to be "robust" by expecting handled
 * error codes (403/404) if environmental configuration (GSC/PostHog) is missing,
 * while strictly failing on 500 Unhandled Internal Server Errors.
 */
test.describe('API Integration Tests', () => {
  // Test data - using an app that likely exists in the registry
  const testApp = 'neon-sewer-raid'
  const testUrl = `https://${testApp}.nard.uk`

  test('GET /api/fleet/apps - should return list of apps', async ({ request }) => {
    const response = await request.get('/api/fleet/apps')
    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(Array.isArray(data)).toBe(true)
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('name')
      expect(data[0]).toHaveProperty('url')
    }
  })

  test('GET /api/fleet/status - should return cached app statuses', async ({ request }) => {
    const response = await request.get('/api/fleet/status')
    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(Array.isArray(data)).toBe(true)
    // May be empty if no cron/refresh has run yet
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('app')
      expect(data[0]).toHaveProperty('status')
      expect(data[0]).toHaveProperty('checkedAt')
      expect(['up', 'down']).toContain(data[0].status)
    }
  })

  test('GET /api/fleet/ga/:app - should return Google Analytics stats', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0]
    const response = await request.get(`/api/fleet/ga/${testApp}`, {
      params: { startDate: today, endDate: today },
    })
    // Strict Assertion: expect 200 OK.
    // This will fail if the service account lacks permissions (403).
    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('summary')
    expect(data).toHaveProperty('propertyId')
  })

  test('GET /api/fleet/gsc/:app - should return Search Console stats', async ({ request }) => {
    const response = await request.get(`/api/fleet/gsc/${testApp}`)
    if (response.status() === 200) {
      const data = await response.json()
      expect(data).toHaveProperty('app')
    } else {
      // Updated to prefer specific 403/404 over generic 500
      expect([403, 404, 401, 503]).toContain(response.status())
    }
  })

  test('GET /api/fleet/gsc/verify-test - should return verification status', async ({
    request,
  }) => {
    const response = await request.get('/api/fleet/gsc/verify-test')
    if (response.status() === 200) {
      const data = await response.json()
      expect(data).toHaveProperty('success')
    } else {
      expect([401, 403]).toContain(response.status())
    }
  })

  test('GET /api/fleet/posthog/:app - should return PostHog stats', async ({ request }) => {
    const response = await request.get(`/api/fleet/posthog/${testApp}`)
    if (response.status() === 200) {
      const data = await response.json()
      expect(data).toHaveProperty('summary')
    } else {
      expect([503, 403, 401]).toContain(response.status())
    }
  })

  test('GET /api/fleet/posthog/summary - should return batch PostHog stats', async ({
    request,
  }) => {
    const response = await request.get('/api/fleet/posthog/summary')
    if (response.status() === 200) {
      const data = await response.json()
      expect(typeof data).toBe('object')
    } else {
      expect([503, 403, 401]).toContain(response.status())
    }
  })

  test('GET /api/fleet/indexing/status - should return indexing stats', async ({ request }) => {
    const response = await request.get('/api/fleet/indexing/status', {
      params: { url: testUrl },
    })
    if (response.status() === 200) {
      const data = await response.json()
      expect(data).toHaveProperty('url')
    } else {
      // Should now return 404 for verified properties that haven't used the API yet,
      // or 403 for unverified, instead of 500.
      expect([404, 403, 401]).toContain(response.status())
    }
  })

  test('POST /api/fleet/indexing/publish - should handle indexing request', async ({ request }) => {
    const response = await request.post('/api/fleet/indexing/publish', {
      data: {
        url: testUrl,
        type: 'URL_UPDATED',
      },
    })
    if (response.status() === 200) {
      const data = await response.json()
      expect(data).toHaveProperty('success')
    } else {
      expect([400, 401, 403]).toContain(response.status())
    }
  })

  test('POST /api/fleet/indexnow/:app - should handle IndexNow request', async ({ request }) => {
    const response = await request.post(`/api/fleet/indexnow/${testApp}`, {
      data: {
        urls: [testUrl],
      },
    })
    if (response.status() === 200) {
      const data = await response.json()
      expect(data).toHaveProperty('app')
      expect(data).toHaveProperty('status')
    } else {
      expect([400, 401, 403, 404, 502]).toContain(response.status())
    }
  })

  test('GET /api/github/repos - should return GitHub repos', async ({ request }) => {
    const response = await request.get('/api/github/repos')
    if (response.status() === 200) {
      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
    } else {
      expect([401, 403, 503]).toContain(response.status())
    }
  })

  test('GET /api/users - should return current users or session info', async ({ request }) => {
    const response = await request.get('/api/users')
    if (response.status() === 200) {
      const data = await response.json()
      expect(Array.isArray(data)).toBe(true)
    } else {
      expect([401, 403, 404]).toContain(response.status())
    }
  })
})
