/**
 * Auth API composable — wraps all auth-related mutations.
 * Pages call these instead of $fetch directly (satisfies no-fetch-in-component).
 *
 * All mutations include `X-Requested-With` header for CSRF protection middleware.
 */
export function useAuthApi() {
  const csrfHeaders = { 'X-Requested-With': 'XMLHttpRequest' } as const

  async function login(payload: { email: string; password: string }) {
    return $fetch<{ user: { id: string; name: string; email: string } }>('/api/auth/login', {
      method: 'POST',
      body: payload,
      headers: csrfHeaders,
    })
  }

  async function register(payload: { name: string; email: string; password: string }) {
    return $fetch<{ user: { id: string; name: string; email: string } }>('/api/auth/register', {
      method: 'POST',
      body: payload,
      headers: csrfHeaders,
    })
  }

  async function loginAsTestUser() {
    return $fetch<{ user: { id: string; name: string; email: string } }>('/api/auth/login-test', {
      method: 'POST',
      headers: csrfHeaders,
    })
  }

  return { login, register, loginAsTestUser }
}
