/**
 * Global auth middleware.
 * Redirects unauthenticated users to /login.
 * Skips login and register pages to avoid redirect loops.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const publicPaths = ['/login', '/register']
  if (publicPaths.includes(to.path)) return

  // Check session via the layer's /api/auth/me endpoint.
  // me.get.ts returns { user: null } with 200 OK when unauthenticated,
  // so we must check the response body — not just catch network errors.
  try {
    const data = await $fetch<{ user: unknown }>('/api/auth/me', {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
    if (!data?.user) {
      return navigateTo('/login')
    }
  } catch {
    return navigateTo('/login')
  }
})
