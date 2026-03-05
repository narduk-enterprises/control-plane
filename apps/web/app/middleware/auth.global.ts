/**
 * Global auth middleware.
 * Redirects unauthenticated users to /login.
 * Skips the login page itself to avoid redirect loops.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // Don't guard the login page
  if (to.path === '/login') return

  // Check session via the layer's /api/auth/me endpoint
  try {
    await $fetch('/api/auth/me', {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
  } catch {
    return navigateTo('/login')
  }
})
