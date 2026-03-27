import type { AnalyticsProviderStatus } from '~/types/analytics'

export interface AnalyticsProviderFleetMetricColumn {
  key: string
  label: string
}

export interface AnalyticsProviderFleetMetric {
  display: string
  sortValue: number
}

export interface AnalyticsProviderFleetTableRow {
  appName: string
  href: string
  hint: string
  status: AnalyticsProviderStatus
  message: string
  metrics: Record<string, AnalyticsProviderFleetMetric>
}
