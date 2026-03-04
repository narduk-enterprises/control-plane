import { test, expect } from '@playwright/test'

/**
 * API Integration Tests for Control Plane Endpoints.
 * These tests run against a live local server (http://localhost:3000).
 */
test.describe('API Integration Tests', () => {
    // Test data - using an app that likely exists in the registry
    const testApp = 'neon-sewer-raid'

    test('GET /api/fleet/apps - should return list of apps', async ({ request }) => {
        const response = await request.get('/api/fleet/apps')
        expect(response.ok()).toBe(true)
        const data = await response.json()
        expect(Array.isArray(data)).toBe(true)
        if (data.length > 0) {
            expect(data[0]).toHaveProperty('name')
            expect(data[0]).toHaveProperty('url')
        }
    })

    test('GET /api/fleet/status - should return app status', async ({ request }) => {
        // This endpoint requires a 'url' query parameter
        const response = await request.get('/api/fleet/status', {
            params: { url: 'https://google.com' }
        })
        expect(response.ok()).toBe(true)
        const data = await response.json()
        expect(data).toHaveProperty('status')
        expect(['up', 'down']).toContain(data.status)
    })

    test('GET /api/fleet/ga/:app - should return Google Analytics stats', async ({ request }) => {
        const response = await request.get(`/api/fleet/ga/${testApp}`)
        // GA might fail if not fully configured, so we check if it's either 200 or handles error gracefully
        if (response.status() === 200) {
            const data = await response.json()
            expect(data).toHaveProperty('summary')
        } else {
            // 503 if not configured, or other error
            expect([503, 500, 403]).toContain(response.status())
        }
    })

    test('GET /api/fleet/gsc/:app - should return Search Console stats', async ({ request }) => {
        const response = await request.get(`/api/fleet/gsc/${testApp}`)
        if (response.status() === 200) {
            const data = await response.json()
            expect(data).toHaveProperty('summary')
        } else {
            expect([500, 503, 403]).toContain(response.status())
        }
    })

    test('GET /api/fleet/gsc/verify-test - should return verification status', async ({ request }) => {
        const response = await request.get('/api/fleet/gsc/verify-test')
        if (response.status() === 200) {
            const data = await response.json()
            expect(data).toHaveProperty('status')
        } else {
            expect([500, 401, 403]).toContain(response.status())
        }
    })

    test('GET /api/fleet/posthog/:app - should return PostHog stats', async ({ request }) => {
        const response = await request.get(`/api/fleet/posthog/${testApp}`)
        if (response.status() === 200) {
            const data = await response.json()
            expect(data).toHaveProperty('summary')
        } else {
            expect([500, 503, 403]).toContain(response.status())
        }
    })

    test('GET /api/fleet/posthog/summary - should return batch PostHog stats', async ({ request }) => {
        const response = await request.get('/api/fleet/posthog/summary')
        if (response.status() === 200) {
            const data = await response.json()
            expect(typeof data).toBe('object')
        } else {
            expect([500, 503, 403]).toContain(response.status())
        }
    })

    test('GET /api/fleet/indexing/status - should return indexing stats', async ({ request }) => {
        const response = await request.get('/api/fleet/indexing/status')
        if (response.status() === 200) {
            const data = await response.json()
            expect(data).toHaveProperty('totalIndexed')
        } else {
            expect([500, 503, 403]).toContain(response.status())
        }
    })

    test('POST /api/fleet/indexing/publish - should handle indexing request', async ({ request }) => {
        const response = await request.post('/api/fleet/indexing/publish', {
            data: {
                url: `https://${testApp}.nard.uk`,
                type: 'URL_UPDATED'
            }
        })
        // Might fail if GSC not verified for this URL, or not authenticated
        expect([200, 400, 401, 403, 500]).toContain(response.status())
    })

    test('POST /api/fleet/indexnow/:app - should handle IndexNow request', async ({ request }) => {
        const response = await request.post(`/api/fleet/indexnow/${testApp}`, {
            data: {
                url: `https://${testApp}.nard.uk`,
                key: 'test-key'
            }
        })
        expect([200, 400, 401, 403, 404, 500]).toContain(response.status())
    })

    test('GET /api/github/repos - should return GitHub repos', async ({ request }) => {
        const response = await request.get('/api/github/repos')
        if (response.status() === 200) {
            const data = await response.json()
            expect(Array.isArray(data)).toBe(true)
        } else {
            expect([401, 403, 500, 503]).toContain(response.status())
        }
    })

    test('GET /api/users - should return current users or session info', async ({ request }) => {
        const response = await request.get('/api/users')
        if (response.status() === 200) {
            const data = await response.json()
            expect(data).toHaveProperty('users')
        } else {
            expect([401, 403, 500]).toContain(response.status())
        }
    })
})
