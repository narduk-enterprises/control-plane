import { describe, it, expect } from 'vitest'
import { apiFetch, anonFetch, authIt, TEST_APP } from './helpers'

describe('Fleet Apps CRUD — /api/fleet/apps', () => {
  const TEST_NEW_APP = `vitest-crud-${Date.now()}`

  // ── GET ────────────────────────────────────────────────────────────
  authIt('GET /api/fleet/apps returns an array of apps', async () => {
    const res = await apiFetch('/api/fleet/apps?force=true')
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)

    const first = data[0]
    expect(first).toHaveProperty('name')
    expect(first).toHaveProperty('url')
    expect(first).toHaveProperty('dopplerProject')
    expect(first).toHaveProperty('isActive')
    expect(first).toHaveProperty('createdAt')
    expect(first).toHaveProperty('updatedAt')
  })

  authIt('GET /api/fleet/apps?includeInactive=true includes inactive apps', async () => {
    const res = await apiFetch('/api/fleet/apps?includeInactive=true')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })

  authIt('GET /api/fleet/apps?force=true bypasses cache', async () => {
    const res = await apiFetch('/api/fleet/apps?force=true')
    expect(res.status).toBe(200)
  })

  // ── POST ───────────────────────────────────────────────────────────
  authIt('POST /api/fleet/apps creates a new app', async () => {
    const res = await apiFetch('/api/fleet/apps', {
      method: 'POST',
      body: JSON.stringify({
        name: TEST_NEW_APP,
        url: `https://${TEST_NEW_APP}.example.com`,
      }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ ok: true, app: TEST_NEW_APP })
  })

  authIt('POST /api/fleet/apps rejects duplicate names (409)', async () => {
    const res = await apiFetch('/api/fleet/apps', {
      method: 'POST',
      body: JSON.stringify({
        name: TEST_NEW_APP,
        url: `https://${TEST_NEW_APP}.example.com`,
      }),
    })
    expect(res.status).toBe(409)
  })

  authIt('POST /api/fleet/apps rejects invalid body (400)', async () => {
    const res = await apiFetch('/api/fleet/apps', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(400)
  })

  authIt('POST /api/fleet/apps rejects name with uppercase/spaces (400)', async () => {
    const res = await apiFetch('/api/fleet/apps', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad Name', url: 'https://x.com' }),
    })
    expect(res.status).toBe(400)
  })

  // ── PUT ────────────────────────────────────────────────────────────
  authIt('PUT /api/fleet/apps/:name updates an existing app', async () => {
    const res = await apiFetch(`/api/fleet/apps/${TEST_NEW_APP}`, {
      method: 'PUT',
      body: JSON.stringify({ gaPropertyId: '123456789' }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ ok: true, app: TEST_NEW_APP })
  })

  authIt('PUT /api/fleet/apps/:name returns 404 for non-existent app', async () => {
    const res = await apiFetch('/api/fleet/apps/nonexistent-app-xyz', {
      method: 'PUT',
      body: JSON.stringify({ url: 'https://x.com' }),
    })
    expect(res.status).toBe(404)
  })

  // ── DELETE ─────────────────────────────────────────────────────────
  authIt('DELETE /api/fleet/apps/:name soft-deletes an app', async () => {
    const res = await apiFetch(`/api/fleet/apps/${TEST_NEW_APP}`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.action).toBe('deactivated')
  })

  authIt('DELETE /api/fleet/apps/:name?hard=true permanently deletes', async () => {
    const res = await apiFetch(`/api/fleet/apps/${TEST_NEW_APP}?hard=true`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.action).toBe('deleted')
  })

  authIt('DELETE /api/fleet/apps/:name returns 404 after hard delete', async () => {
    const res = await apiFetch(`/api/fleet/apps/${TEST_NEW_APP}`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(404)
  })

  // ── Auth guard ─────────────────────────────────────────────────────
  it('GET /api/fleet/apps returns 401 without auth', async () => {
    const res = await anonFetch('/api/fleet/apps')
    expect(res.status).toBe(401)
  })

  // ── Nullable fields — gaPropertyId, posthogAppName ────────────────
  authIt('apps list contains gaPropertyId and posthogAppName fields (possibly null)', async () => {
    const res = await apiFetch('/api/fleet/apps?includeInactive=true')
    expect(res.status).toBe(200)
    const data = await res.json()

    for (const app of data) {
      expect(app).toHaveProperty('gaPropertyId')
      expect(app).toHaveProperty('posthogAppName')
      expect(typeof app.gaPropertyId === 'string' || app.gaPropertyId === null).toBe(true)
      expect(typeof app.posthogAppName === 'string' || app.posthogAppName === null).toBe(true)
    }

    const withNullGa = data.filter((a: Record<string, unknown>) => a.gaPropertyId === null)
    const withNullPh = data.filter((a: Record<string, unknown>) => a.posthogAppName === null)
    if (withNullGa.length > 0) {
      console.log(
        `[INFO] ${withNullGa.length} apps have null gaPropertyId:`,
        withNullGa.map((a: Record<string, unknown>) => a.name),
      )
    }
    if (withNullPh.length > 0) {
      console.log(
        `[INFO] ${withNullPh.length} apps have null posthogAppName:`,
        withNullPh.map((a: Record<string, unknown>) => a.name),
      )
    }
  })
})
