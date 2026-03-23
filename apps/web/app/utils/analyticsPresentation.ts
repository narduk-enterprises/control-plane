import type {
  AnalyticsInsight,
  AnalyticsProviderStatus,
  FleetAnalyticsSnapshot,
} from '~/types/analytics'
import type { FleetRegistryApp } from '~/types/fleet'

export type AnalyticsSurface = 'overview' | 'ga' | 'gsc' | 'posthog' | 'indexing'
export type AnalyticsProviderKey = 'ga' | 'gsc' | 'posthog' | 'indexnow'

export const ANALYTICS_SURFACE_OPTIONS: Array<{
  value: AnalyticsSurface
  label: string
  icon: string
  description: string
}> = [
  {
    value: 'overview',
    label: 'Overview',
    icon: 'i-lucide-layout-dashboard',
    description: 'Fleet health, integration readiness, and the shared analytics snapshot.',
  },
  {
    value: 'ga',
    label: 'GA4',
    icon: 'i-lucide-activity',
    description: 'Google Analytics fleet metrics without the rest of the noise.',
  },
  {
    value: 'gsc',
    label: 'GSC',
    icon: 'i-lucide-search',
    description: 'Search Console visibility, clicks, and indexing context by app.',
  },
  {
    value: 'posthog',
    label: 'PostHog',
    icon: 'i-lucide-bar-chart-3',
    description: 'Product analytics, traffic sources, and session replay handoff.',
  },
  {
    value: 'indexing',
    label: 'Indexing',
    icon: 'i-lucide-send',
    description: 'IndexNow and GSC sitemap operations, fetched only when you open them.',
  },
]

const ANALYTICS_SURFACE_SET = new Set<AnalyticsSurface>(
  ANALYTICS_SURFACE_OPTIONS.map((option) => option.value),
)

export function normalizeAnalyticsSurface(value: string | null | undefined): AnalyticsSurface {
  if (!value) return 'overview'
  return ANALYTICS_SURFACE_SET.has(value as AnalyticsSurface)
    ? (value as AnalyticsSurface)
    : 'overview'
}

export function analyticsSurfaceHref(surface: AnalyticsSurface, appName?: string) {
  const path = appName ? `/analytics/${encodeURIComponent(appName)}` : '/analytics'
  return surface === 'overview' ? path : `${path}?view=${surface}`
}

export function providerLabel(provider: AnalyticsProviderKey) {
  switch (provider) {
    case 'ga':
      return 'GA4'
    case 'gsc':
      return 'GSC'
    case 'posthog':
      return 'PostHog'
    case 'indexnow':
      return 'IndexNow'
  }
}

export function providerSurface(provider: AnalyticsProviderKey): AnalyticsSurface {
  switch (provider) {
    case 'ga':
      return 'ga'
    case 'gsc':
      return 'gsc'
    case 'posthog':
      return 'posthog'
    case 'indexnow':
      return 'indexing'
  }
}

export function providerStatusColor(status: AnalyticsProviderStatus) {
  switch (status) {
    case 'healthy':
      return 'success'
    case 'stale':
      return 'warning'
    case 'missing_registry':
    case 'missing_config':
    case 'access_denied':
    case 'error':
      return 'error'
    case 'no_data':
    default:
      return 'neutral'
  }
}

export function providerStatusText(status: AnalyticsProviderStatus) {
  switch (status) {
    case 'healthy':
      return 'Healthy'
    case 'stale':
      return 'Refreshing'
    case 'no_data':
      return 'No data'
    case 'missing_registry':
      return 'Missing registry'
    case 'missing_config':
      return 'Missing config'
    case 'access_denied':
      return 'Access denied'
    case 'error':
      return 'Error'
  }
}

type IssueSeverity = 'critical' | 'warning' | 'info'

function providerSeverity(status: AnalyticsProviderStatus): IssueSeverity | null {
  switch (status) {
    case 'missing_registry':
    case 'missing_config':
    case 'access_denied':
    case 'error':
      return 'critical'
    case 'stale':
      return 'warning'
    default:
      return null
  }
}

export interface AnalyticsIssueGroup {
  id: string
  provider: AnalyticsProviderKey
  label: string
  surface: AnalyticsSurface
  severity: IssueSeverity
  message: string
  appCount: number
  apps: string[]
}

export function buildAnalyticsIssueGroups(
  apps: FleetRegistryApp[],
  snapshotMap: Record<string, FleetAnalyticsSnapshot | null>,
) {
  const groups = new Map<string, AnalyticsIssueGroup>()

  for (const app of apps) {
    const snapshot = snapshotMap[app.name]
    if (!snapshot) continue

    const providers: Array<{
      key: AnalyticsProviderKey
      status: AnalyticsProviderStatus
      message: string | null
    }> = [
      { key: 'ga', status: snapshot.ga.status, message: snapshot.ga.message },
      { key: 'gsc', status: snapshot.gsc.status, message: snapshot.gsc.message },
      { key: 'posthog', status: snapshot.posthog.status, message: snapshot.posthog.message },
      { key: 'indexnow', status: snapshot.indexnow.status, message: snapshot.indexnow.message },
    ]

    for (const provider of providers) {
      const severity = providerSeverity(provider.status)
      if (!severity) continue

      const message = provider.message ?? `${providerLabel(provider.key)} needs attention.`
      const id = `${provider.key}:${severity}:${message}`
      const existing = groups.get(id)

      if (existing) {
        existing.apps.push(app.name)
        existing.appCount += 1
        continue
      }

      groups.set(id, {
        id,
        provider: provider.key,
        label: providerLabel(provider.key),
        surface: providerSurface(provider.key),
        severity,
        message,
        appCount: 1,
        apps: [app.name],
      })
    }
  }

  return Array.from(groups.values()).sort((left, right) => {
    const severityRank = { critical: 0, warning: 1, info: 2 }
    return (
      severityRank[left.severity] - severityRank[right.severity] ||
      right.appCount - left.appCount ||
      left.label.localeCompare(right.label)
    )
  })
}

export interface AnalyticsInsightGroup {
  id: string
  severity: AnalyticsInsight['severity']
  message: string
  metric: string
  appCount: number
  apps: string[]
}

export function buildAnalyticsInsightGroups(insights: AnalyticsInsight[]) {
  const groups = new Map<string, AnalyticsInsightGroup>()

  for (const insight of insights) {
    const id = `${insight.severity}:${insight.metric}:${insight.message}`
    const existing = groups.get(id)

    if (existing) {
      existing.apps.push(insight.appName)
      existing.appCount += 1
      continue
    }

    groups.set(id, {
      id,
      severity: insight.severity,
      message: insight.message,
      metric: insight.metric,
      appCount: 1,
      apps: [insight.appName],
    })
  }

  return Array.from(groups.values()).sort((left, right) => {
    const severityRank = { critical: 0, warning: 1, info: 2 }
    return (
      severityRank[left.severity] - severityRank[right.severity] ||
      right.appCount - left.appCount ||
      left.metric.localeCompare(right.metric)
    )
  })
}
