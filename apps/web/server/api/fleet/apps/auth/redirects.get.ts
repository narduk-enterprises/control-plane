import { requireAdmin } from '#layer/server/utils/auth'
import {
  listFleetAuthRedirects,
  parseFleetAuthProviders,
  resolveFleetAuthConfig,
} from '#server/data/fleet-auth'
import { getAllFleetApps } from '#server/data/fleet-registry'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const apps = await getAllFleetApps(event)
  const { redirects, issues } = listFleetAuthRedirects(
    apps.map((app) => ({
      name: app.name,
      ...resolveFleetAuthConfig({
        authEnabled: app.authEnabled,
        redirectBaseUrl: app.redirectBaseUrl ?? app.url,
        loginPath: app.loginPath,
        callbackPath: app.callbackPath,
        logoutPath: app.logoutPath,
        confirmPath: app.confirmPath,
        resetPath: app.resetPath,
        publicSignup: app.publicSignup,
        providers: parseFleetAuthProviders(app.providers),
        requireMfa: app.requireMfa,
      }),
    })),
  )

  return {
    redirects,
    issues,
  }
})
