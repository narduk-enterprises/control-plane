/**
 * useAuthApi — Auth API wrapper composable with CSRF headers.
 *
 * For pages/components that need to call auth endpoints directly
 * without going through useAuth's state management.
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

  async function logout() {
    return $fetch<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
      headers: csrfHeaders,
    })
  }

  async function loginAsTestUser() {
    return $fetch<{ user: { id: string; name: string; email: string } }>('/api/auth/login-test', {
      method: 'POST',
      headers: csrfHeaders,
    })
  }

  return { login, register, logout, loginAsTestUser }
}
