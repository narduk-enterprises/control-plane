/**
 * Shared helpers for integration tests.
 *
 * All tests hit the local Nuxt dev server at BASE_URL.
 * Auth is via API key (Authorization: Bearer nk_...) — set TEST_API_KEY env var.
 * Admin-only tests auto-skip when no valid key is available.
 *
 * Usage:
 *   TEST_API_KEY="nk_..." pnpm --filter web test:integration
 */
import { expect, test as baseIt } from 'vitest'

export const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

/**
 * API key for admin access. Set via TEST_API_KEY env var.
 * Generated via POST /api/auth/api-keys or scripts/create-test-api-key.ts.
 */
export const API_KEY = process.env.TEST_API_KEY || ''

/**
 * A known fleet app that should exist in the registry.
 */
export const TEST_APP = process.env.TEST_APP_SLUG || 'neon-sewer-raid'

/** Whether we have an API key configured at all. */
export const HAS_AUTH = API_KEY.length > 0

/** Resolved once — true if the API key is valid for admin access. */
let _authChecked = false
let _authValid = false

async function checkAuth(): Promise<boolean> {
  if (_authChecked) return _authValid
  _authChecked = true

  if (!HAS_AUTH) {
    _authValid = false
    return false
  }

  try {
    const res = await apiFetch('/api/fleet/apps')
    _authValid = res.status === 200
    if (!_authValid) {
      console.warn(
        `[WARN] TEST_API_KEY is set but returned ${res.status} — admin tests will be skipped.`,
      )
    }
  } catch {
    _authValid = false
  }
  return _authValid
}

/** Pre-check auth validity. Resolved once per test run. */
export const authReady: Promise<boolean> = HAS_AUTH ? checkAuth() : Promise.resolve(false)

/**
 * Use this instead of `it(...)` for tests that require admin auth.
 * Cleanly skips when no valid API key is available.
 */
export function authIt(name: string, fn: () => Promise<void>) {
  baseIt(name, async (ctx) => {
    const isValid = await authReady
    if (!isValid) {
      ctx.skip()
      return
    }
    await fn()
    expect(true).toBe(true) // vitest/expect-expect: assertions live in fn()
  })
}

/** Authenticated fetch — includes API key Bearer token. */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${BASE_URL}${path}`
  return fetch(url, {
    ...init,
    headers: {
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
      'x-requested-with': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      ...((init?.headers as Record<string, string>) ?? {}),
    },
  })
}

/** Unauthenticated fetch — no auth header. */
export function anonFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${BASE_URL}${path}`
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...((init?.headers as Record<string, string>) ?? {}),
    },
  })
}

/**
 * Assert that a response is NOT a 500 Internal Server Error.
 */
export function assertNot500(status: number, context: string): void {
  if (status === 500) {
    throw new Error(`Unexpected 500 Internal Server Error on ${context}`)
  }
}
