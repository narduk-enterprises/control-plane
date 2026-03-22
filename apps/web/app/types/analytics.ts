/**
 * Canonical analytics contracts shared by composables, stores, and UI.
 * Raw provider responses remain here for compatibility, but the UI should
 * consume FleetAnalyticsSnapshot / FleetAnalyticsSummaryResponse.
 */

export type AnalyticsProviderStatus =
  | 'healthy'
  | 'stale'
  | 'no_data'
  | 'missing_registry'
  | 'missing_config'
  | 'access_denied'
  | 'error'

export type AnalyticsDataSource = 'live' | 'cache' | 'derived' | 'none'

export interface AnalyticsCacheMeta {
  cachedAt: string
  stale: boolean
}

export interface AnalyticsRange {
  startDate: string
  endDate: string
}

export interface FleetAnalyticsAppInfo {
  name: string
  url: string
  dopplerProject: string
  gaPropertyId?: string | null
  gaMeasurementId?: string | null
  posthogAppName?: string | null
  githubRepo?: string | null
  isActive?: boolean
}

export interface AnalyticsProviderSnapshot<TMetrics = unknown> {
  status: AnalyticsProviderStatus
  source: AnalyticsDataSource
  stale: boolean
  lastUpdatedAt: string | null
  message: string | null
  metrics: TMetrics | null
}

// ── GA4 ──────────────────────────────────────────────────────────────

export interface GaSummary {
  activeUsers: number
  newUsers: number
  sessions: number
  screenPageViews: number
  bounceRate: number
  averageSessionDuration: number
  engagementRate: number
  eventCount: number
}

export interface GaDeltas {
  users?: number
  newUsers?: number
  sessions?: number
  pageviews?: number
  bounceRate?: number
  avgSessionDuration?: number
  eventCount?: number
  engagementRate?: number
}

export interface GaTimeSeriesPoint {
  date: string
  value: number
}

export interface FleetGAResponse {
  app: string
  propertyId: string
  summary: GaSummary | null
  deltas: GaDeltas | null
  timeSeries: GaTimeSeriesPoint[]
  startDate: string
  endDate: string
  fetchedAt: string
}

export interface FleetAnalyticsGaMetrics {
  propertyId: string
  summary: GaSummary | null
  deltas: GaDeltas | null
  timeSeries: GaTimeSeriesPoint[]
}

// ── GSC ──────────────────────────────────────────────────────────────

export type GscDimension = 'query' | 'page' | 'device' | 'country' | 'searchAppearance'

export interface GscRow {
  keys?: string[]
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
}

export interface GscTotals {
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
}

export interface GscInspection {
  inspectionResultLink?: string
  indexStatusResult?: {
    verdict?: string
    coverageState?: string
    crawledAs?: string
    lastCrawlTime?: string
  }
}

export interface GscQueryParams {
  startDate: string
  endDate: string
  dimension: GscDimension
  force?: boolean
}

export interface GscSeriesPoint {
  date: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface FleetGscResponse {
  app: string
  rows: GscRow[]
  totals: GscTotals | null
  inspection: GscInspection | null
  startDate: string
  endDate: string
  dimension: string
  gscSiteUrl?: string
  note?: string
  fetchedAt: string
}

export interface FleetGscSeriesResponse {
  app: string
  timeSeries: GscSeriesPoint[]
  compareTimeSeries?: GscSeriesPoint[]
  startDate: string
  endDate: string
  fetchedAt: string
}

export interface FleetAnalyticsGscMetrics {
  totals: GscTotals | null
  queries: GscRow[]
  devices: GscRow[]
  timeSeries: GscSeriesPoint[]
  inspection: GscInspection | null
  siteUrl: string | null
  note: string | null
}

// ── PostHog ──────────────────────────────────────────────────────────

export interface PosthogTopItem {
  name: string
  count: number
}

export interface FleetPosthogResponse {
  app: string
  summary: Record<string, number>
  timeSeries: GaTimeSeriesPoint[]
  topPages: PosthogTopItem[]
  topReferrers: PosthogTopItem[]
  topCountries: PosthogTopItem[]
  topBrowsers: PosthogTopItem[]
  replaysUrl: string
  startDate: string
  endDate: string
  fetchedAt: string
}

export interface FleetPosthogSummaryResponse {
  generatedAt: string
  apps: Record<
    string,
    {
      eventCount: number
      users: number
      pageviews: number
      sessions: number
      fetchedAt: string
    }
  >
}

export interface FleetAnalyticsPosthogMetrics {
  summary: Record<string, number>
  timeSeries: GaTimeSeriesPoint[]
  topPages: PosthogTopItem[]
  topReferrers: PosthogTopItem[]
  topCountries: PosthogTopItem[]
  topBrowsers: PosthogTopItem[]
  replaysUrl: string | null
}

// ── IndexNow ─────────────────────────────────────────────────────────

export interface FleetAnalyticsIndexnowMetrics {
  lastSubmission: string | null
  totalSubmissions: number
  lastSubmittedCount: number | null
}

// ── Canonical snapshots ─────────────────────────────────────────────

export interface FleetAnalyticsSnapshot {
  app: FleetAnalyticsAppInfo
  range: AnalyticsRange
  generatedAt: string
  health: {
    status: 'up' | 'down' | 'unknown'
    checkedAt: string | null
  }
  ga: AnalyticsProviderSnapshot<FleetAnalyticsGaMetrics>
  gsc: AnalyticsProviderSnapshot<FleetAnalyticsGscMetrics>
  posthog: AnalyticsProviderSnapshot<FleetAnalyticsPosthogMetrics>
  indexnow: AnalyticsProviderSnapshot<FleetAnalyticsIndexnowMetrics>
}

export interface FleetAnalyticsSummaryTotals {
  gaUsers: number
  gaPageviews: number
  gscClicks: number
  gscImpressions: number
  posthogEvents: number
  posthogUsers: number
  healthyProviders: {
    ga: number
    gsc: number
    posthog: number
    indexnow: number
  }
  problemProviders: {
    ga: number
    gsc: number
    posthog: number
    indexnow: number
  }
}

export interface FleetAnalyticsSummaryResponse {
  startDate: string
  endDate: string
  generatedAt: string
  apps: Record<string, FleetAnalyticsSnapshot>
  totals: FleetAnalyticsSummaryTotals
  insights: AnalyticsInsight[]
}

export type FleetAnalyticsDetailResponse = FleetAnalyticsSnapshot

// ── Integration health ──────────────────────────────────────────────

export type IntegrationHealthStatus = 'configured' | 'partial' | 'missing'

export interface FleetIntegrationHealthCheck {
  key: string
  label: string
  status: IntegrationHealthStatus
  message: string
}

export interface FleetIntegrationHealthResponse {
  generatedAt: string
  lastSnapshotAt: string | null
  fleet: {
    totalApps: number
    appsWithGaPropertyId: number
    appsWithGaMeasurementId: number
    appsWithPosthogAppName: number
  }
  services: FleetIntegrationHealthCheck[]
}

// ── Insights ─────────────────────────────────────────────────────────

export interface AnalyticsInsight {
  type: 'spike' | 'drop' | 'milestone'
  severity: 'info' | 'warning' | 'critical'
  appName: string
  message: string
  metric: string
  currentValue?: number
  previousValue?: number
  delta?: number
}

// ── Stat Card Props ──────────────────────────────────────────────────

export type StatFormat = 'number' | 'percent' | 'duration'

export interface StatCardConfig {
  label: string
  value: number | undefined
  delta?: number
  format?: StatFormat
  invertDelta?: boolean
  icon?: string
  iconColor?: string
}
