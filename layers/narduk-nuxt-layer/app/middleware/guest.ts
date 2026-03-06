/**
 * Guest-only middleware — redirects authenticated users to the dashboard.
 *
 * Apply to pages that should only be visible to unauthenticated users
 * (login, register, index landing).
 */
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn } = useUserSession()

  if (loggedIn.value) {
    return navigateTo('/dashboard/', { replace: true })
  }
})
