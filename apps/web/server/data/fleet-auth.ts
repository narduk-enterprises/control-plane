export type FleetAuthProvider = 'apple' | 'email'

export interface FleetAuthConfig {
  authEnabled: boolean
  redirectBaseUrl: string | null
  loginPath: string
  callbackPath: string
  logoutPath: string
  confirmPath: string
  resetPath: string
  publicSignup: boolean
  providers: FleetAuthProvider[]
  requireMfa: boolean
}

export interface FleetAuthRedirects {
  callbackUrl: string
  confirmUrl: string
  resetUrl: string
}

function toAllowListPattern(url: URL) {
  // Supabase matches redirect_to against the configured allow-list. The app auth
  // bridge appends query params like ?next=... to these routes, so the shared
  // registry must emit path-scoped wildcard patterns instead of exact URLs.
  return `${url.origin}${url.pathname}**`
}

const DEFAULT_FLEET_AUTH_CONFIG: Omit<FleetAuthConfig, 'redirectBaseUrl'> = {
  authEnabled: true,
  loginPath: '/login',
  callbackPath: '/auth/callback',
  logoutPath: '/logout',
  confirmPath: '/auth/confirm',
  resetPath: '/reset-password',
  publicSignup: true,
  providers: ['apple', 'email'],
  requireMfa: false,
}

export function parseFleetAuthProviders(value: string | null | undefined): FleetAuthProvider[] {
  const parsed = (value || DEFAULT_FLEET_AUTH_CONFIG.providers.join(','))
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider): provider is FleetAuthProvider => provider === 'apple' || provider === 'email')

  return parsed.length > 0 ? [...new Set(parsed)] : [...DEFAULT_FLEET_AUTH_CONFIG.providers]
}

export function serializeFleetAuthProviders(providers: FleetAuthProvider[]) {
  return [...new Set(providers)].join(',')
}

export function resolveFleetAuthConfig(
  input: Partial<FleetAuthConfig> & { redirectBaseUrl?: string | null; url?: string | null },
): FleetAuthConfig {
  const redirectBaseUrl = (input.redirectBaseUrl ?? input.url ?? null)?.trim() || null

  return {
    authEnabled: input.authEnabled ?? Boolean(redirectBaseUrl),
    redirectBaseUrl,
    loginPath: input.loginPath || DEFAULT_FLEET_AUTH_CONFIG.loginPath,
    callbackPath: input.callbackPath || DEFAULT_FLEET_AUTH_CONFIG.callbackPath,
    logoutPath: input.logoutPath || DEFAULT_FLEET_AUTH_CONFIG.logoutPath,
    confirmPath: input.confirmPath || DEFAULT_FLEET_AUTH_CONFIG.confirmPath,
    resetPath: input.resetPath || DEFAULT_FLEET_AUTH_CONFIG.resetPath,
    publicSignup: input.publicSignup ?? DEFAULT_FLEET_AUTH_CONFIG.publicSignup,
    providers:
      input.providers && input.providers.length > 0
        ? [...new Set(input.providers)]
        : [...DEFAULT_FLEET_AUTH_CONFIG.providers],
    requireMfa: input.requireMfa ?? DEFAULT_FLEET_AUTH_CONFIG.requireMfa,
  }
}

export function validateFleetAuthConfig(appName: string, config: FleetAuthConfig): string[] {
  if (!config.authEnabled) {
    return []
  }

  const issues: string[] = []
  const requiredPaths = {
    callbackPath: config.callbackPath,
    confirmPath: config.confirmPath,
    resetPath: config.resetPath,
  }

  if (!config.redirectBaseUrl) {
    issues.push(`${appName}: authEnabled requires redirectBaseUrl`)
  } else {
    try {
      const url = new URL(config.redirectBaseUrl)
      if (url.protocol !== 'https:') {
        issues.push(`${appName}: redirectBaseUrl must use https`)
      }
    } catch {
      issues.push(`${appName}: redirectBaseUrl must be a valid absolute URL`)
    }

    if (config.redirectBaseUrl.includes('*')) {
      issues.push(`${appName}: wildcard redirectBaseUrl values are not allowed`)
    }
  }

  if (config.providers.length === 0) {
    issues.push(`${appName}: at least one auth provider is required`)
  }

  for (const [label, value] of Object.entries(requiredPaths)) {
    if (!value) {
      issues.push(`${appName}: ${label} is required when authEnabled is true`)
      continue
    }

    if (!value.startsWith('/')) {
      issues.push(`${appName}: ${label} must start with "/"`)
    }

    if (value.includes('*')) {
      issues.push(`${appName}: ${label} cannot include wildcards`)
    }
  }

  return issues
}

export function buildFleetAuthRedirects(config: FleetAuthConfig): FleetAuthRedirects | null {
  if (!config.authEnabled || !config.redirectBaseUrl) {
    return null
  }

  return {
    callbackUrl: toAllowListPattern(new URL(config.callbackPath, config.redirectBaseUrl)),
    confirmUrl: toAllowListPattern(new URL(config.confirmPath, config.redirectBaseUrl)),
    resetUrl: toAllowListPattern(new URL(config.resetPath, config.redirectBaseUrl)),
  }
}

export function listFleetAuthRedirects(
  apps: Array<{ name: string } & FleetAuthConfig>,
) {
  const redirects = new Set<string>()
  const issues: string[] = []
  const seenUrls = new Map<string, string>()

  for (const app of apps) {
    const appIssues = validateFleetAuthConfig(app.name, app)
    issues.push(...appIssues)

    const built = buildFleetAuthRedirects(app)
    if (!built) continue

    for (const url of Object.values(built)) {
      const prior = seenUrls.get(url)
      if (prior && prior !== app.name) {
        issues.push(`${app.name}: duplicate auth redirect URL already claimed by ${prior}: ${url}`)
      } else {
        seenUrls.set(url, app.name)
      }

      redirects.add(url)
    }
  }

  return {
    redirects: [...redirects].sort((left, right) => left.localeCompare(right)),
    issues,
  }
}
