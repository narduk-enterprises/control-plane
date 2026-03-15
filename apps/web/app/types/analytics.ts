/**
 * Centralized analytics types — single source of truth for all GA4, GSC,
 * and PostHog API response shapes used by composables and components.
 */

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

export interface FleetGscResponse {
  app: string
  rows: GscRow[]
  totals: GscTotals | null
  inspection: GscInspection | null
  startDate: string
  endDate: string
  dimension: string
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
