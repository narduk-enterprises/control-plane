/**
 * Global auth middleware.
 * Redirects unauthenticated users to /login.
 * Skips login and register pages to avoid redirect loops.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const publicPaths = ['/login', '/register']
  if (publicPaths.includes(to.path)) return

  // Check session via the layer's /api/auth/me endpoint
  try {
    await $fetch('/api/auth/me', {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
  } catch {
    return navigateTo('/login')
  }
})
