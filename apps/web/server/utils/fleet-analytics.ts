import { eq } from 'drizzle-orm'
import { createError as createH3Error, type H3Event } from 'h3'
import { z } from 'zod'
import { getD1CacheDB, withD1Cache } from '#layer/server/utils/d1Cache'
import { GA_SCOPES, GSC_SCOPES, GoogleApiError, googleApiFetch } from '#layer/server/utils/google'
import {
  getFleetAppByName,
  getFleetApps,
  invalidateFleetAppListCache,
  type FleetApp,
} from '#server/data/fleet-registry'
import { appStatus, fleetApps } from '#server/database/schema'
import { buildPosthogEventWhereClause } from '#server/utils/posthog-query'
import type { AppStatus } from '#server/database/schema'
import type {
  AnalyticsTopListItem,
  AnalyticsCacheMeta,
  AnalyticsDataSource,
  AnalyticsInsight,
  AnalyticsProviderSnapshot,
  AnalyticsProviderStatus,
  AnalyticsRange,
  FleetAnalyticsDetailResponse,
  FleetAnalyticsGaMetrics,
  FleetAnalyticsGscMetrics,
  FleetAnalyticsIndexnowMetrics,
  FleetAnalyticsPosthogMetrics,
  FleetAnalyticsSnapshot,
  FleetAnalyticsSummaryResponse,
  FleetAnalyticsSummaryTotals,
  FleetGAResponse,
  FleetGscResponse,
  FleetGscSeriesResponse,
  FleetIntegrationHealthCheck,
  FleetIntegrationHealthResponse,
  FleetPosthogResponse,
  FleetPosthogSummaryResponse,
  GaSummary,
  GaTimeSeriesPoint,
  GaDeltas,
  GscDimension,
  GscInspection,
  GscRow,
  GscSeriesPoint,
  GscTotals,
} from '~/types/analytics'

const DAILY_WINDOW_DAYS = 30
/** Rolling ranges (end date ≥ today): short TTL — data still moving. */
const ROLLING_SNAPSHOT_TTL_SECONDS = 15 * 60
const ROLLING_SNAPSHOT_STALE_WINDOW_SECONDS = 15 * 60
/** Historical ranges (end date before UTC today): keep D1 rows hot for days. */
const HISTORICAL_SNAPSHOT_TTL_SECONDS = 7 * 24 * 3600
const HISTORICAL_SNAPSHOT_STALE_WINDOW_SECONDS = 24 * 3600

const ROLLING_SUMMARY_TTL_SECONDS = 5 * 60
const ROLLING_SUMMARY_STALE_WINDOW_SECONDS = 5 * 60
const HISTORICAL_SUMMARY_TTL_SECONDS = 14 * 24 * 3600
const HISTORICAL_SUMMARY_STALE_WINDOW_SECONDS = 2 * 24 * 3600

const DETAIL_MODE = 'detail'
const SUMMARY_MODE = 'summary'
/**
 * Bump when analytics query semantics change so cached snapshots refresh
 * immediately after deploy instead of serving stale provider data.
 */
const ANALYTICS_CACHE_VERSION = 'v2'

type SnapshotMode = typeof DETAIL_MODE | typeof SUMMARY_MODE

const analyticsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  force: z.enum(['true', 'false']).optional(),
})

interface ProviderEnvelope<T> {
  data: T
  _meta: AnalyticsCacheMeta
}

interface SnapshotBuildOptions {
  force?: boolean
  mode?: SnapshotMode
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? ''
}

/** True when the range still includes “today” in UTC — metrics may change; use short cache TTL. */
function isRollingAnalyticsRange(range: AnalyticsRange): boolean {
  const today = formatDate(new Date())
  return range.endDate >= today
}

function snapshotCachePolicy(range: AnalyticsRange): {
  ttlSeconds: number
  staleWindowSeconds: number
} {
  return isRollingAnalyticsRange(range)
    ? {
        ttlSeconds: ROLLING_SNAPSHOT_TTL_SECONDS,
        staleWindowSeconds: ROLLING_SNAPSHOT_STALE_WINDOW_SECONDS,
      }
    : {
        ttlSeconds: HISTORICAL_SNAPSHOT_TTL_SECONDS,
        staleWindowSeconds: HISTORICAL_SNAPSHOT_STALE_WINDOW_SECONDS,
      }
}

function summaryCachePolicy(range: AnalyticsRange): {
  ttlSeconds: number
  staleWindowSeconds: number
} {
  return isRollingAnalyticsRange(range)
    ? {
        ttlSeconds: ROLLING_SUMMARY_TTL_SECONDS,
        staleWindowSeconds: ROLLING_SUMMARY_STALE_WINDOW_SECONDS,
      }
    : {
        ttlSeconds: HISTORICAL_SUMMARY_TTL_SECONDS,
        staleWindowSeconds: HISTORICAL_SUMMARY_STALE_WINDOW_SECONDS,
      }
}

function normalizeCalendarRange(input: {
  startDate?: string
  endDate?: string
  defaultDays?: number
}): AnalyticsRange {
  const defaultDays = input.defaultDays ?? DAILY_WINDOW_DAYS
  let endDate = (input.endDate ?? new Date().toISOString()).split('T')[0] ?? ''

  const startFallback = new Date(endDate)
  startFallback.setDate(startFallback.getDate() - defaultDays)

  let startDate = (input.startDate ?? startFallback.toISOString()).split('T')[0] ?? ''

  if (startDate > endDate) {
    const temp = startDate
    startDate = endDate
    endDate = temp
  }

  return { startDate, endDate }
}

function normalizeTimestampRange(input: { startDate?: string; endDate?: string }): {
  start: Date
  end: Date
  startDate: string
  endDate: string
} {
  let end = input.endDate ? new Date(input.endDate) : new Date()
  if (input.endDate && !input.endDate.includes('T')) {
    end.setUTCHours(23, 59, 59, 999)
  }

  let start = input.startDate ? new Date(input.startDate) : new Date(end.getTime())
  if (start.getTime() > end.getTime()) {
    const temp = start
    start = end
    end = temp
  }

  return {
    start,
    end,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

function isTimestampInput(value: string | undefined): boolean {
  return Boolean(value?.includes('T'))
}

function isTimestampRange(range: AnalyticsRange): boolean {
  return isTimestampInput(range.startDate) || isTimestampInput(range.endDate)
}

function formatUtcTimeLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(date)
}

function formatUtcBucketLabel(date: Date, unit: 'minute' | 'hour' | 'day'): string {
  if (unit === 'day') return date.toISOString().slice(0, 10)
  if (unit === 'hour') {
    const hour = String(date.getUTCHours()).padStart(2, '0')
    return `${hour}:00`
  }
  return formatUtcTimeLabel(date)
}

function mapTopList(
  rows: Array<{
    dimensionValues?: Array<{ value: string }>
    metricValues?: Array<{ value: string }>
  }>,
  fallbackName: string,
  metricIndex = 0,
): AnalyticsTopListItem[] {
  return rows
    .map((row) => ({
      name: String(row.dimensionValues?.[0]?.value || fallbackName),
      count: Number(row.metricValues?.[metricIndex]?.value ?? 0),
    }))
    .filter((row) => row.count > 0)
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
}

function buildRealtimeSeries(
  end: Date,
  minutesBack: number,
  rows: Array<{
    dimensionValues?: Array<{ value: string }>
    metricValues?: Array<{ value: string }>
  }>,
): GaTimeSeriesPoint[] {
  const byMinute = new Map<number, number>()
  for (const row of rows) {
    const minute = Number(row.dimensionValues?.[0]?.value ?? Number.NaN)
    if (Number.isNaN(minute)) continue
    byMinute.set(minute, Number(row.metricValues?.[0]?.value ?? 0))
  }

  const points: GaTimeSeriesPoint[] = []
  for (let minute = minutesBack - 1; minute >= 0; minute--) {
    const bucketTime = new Date(end.getTime() - minute * 60_000)
    points.push({
      date: formatUtcBucketLabel(bucketTime, 'minute'),
      value: byMinute.get(minute) ?? 0,
    })
  }
  return points
}

function classifyPosthogSeriesUnit(
  range: ReturnType<typeof normalizeTimestampRange>,
): 'minute' | 'hour' | 'day' {
  const durationMs = range.end.getTime() - range.start.getTime()
  if (durationMs <= 6 * 60 * 60 * 1000) return 'minute'
  if (durationMs <= 36 * 60 * 60 * 1000) return 'hour'
  return 'day'
}

function buildPosthogTimeSeriesQuery(
  timeAndAppFilter: string,
  unit: 'minute' | 'hour' | 'day',
): string {
  if (unit === 'minute') {
    return `
      SELECT formatDateTime(toStartOfInterval(timestamp, INTERVAL 5 minute), '%H:%i') AS date,
             countIf(event = '$pageview') AS pageviews
      FROM events
      ${timeAndAppFilter}
      GROUP BY date
      ORDER BY date ASC
    `
  }

  if (unit === 'hour') {
    return `
      SELECT formatDateTime(toStartOfHour(timestamp), '%H:00') AS date,
             countIf(event = '$pageview') AS pageviews
      FROM events
      ${timeAndAppFilter}
      GROUP BY date
      ORDER BY date ASC
    `
  }

  return `
    SELECT toDate(timestamp) AS date, countIf(event = '$pageview') AS pageviews
    FROM events
    ${timeAndAppFilter}
    GROUP BY date
    ORDER BY date ASC
  `
}

function providerSource(
  meta: AnalyticsCacheMeta,
  fetchedAt: string | undefined,
): AnalyticsDataSource {
  if (!fetchedAt) return 'none'
  if (meta.stale) return 'cache'
  return Date.now() - new Date(fetchedAt).getTime() < 10_000 ? 'live' : 'cache'
}

function createProviderSnapshot<TMetrics>(
  status: AnalyticsProviderStatus,
  metrics: TMetrics | null,
  message: string | null,
  meta?: AnalyticsCacheMeta,
  fetchedAt?: string | null,
): AnalyticsProviderSnapshot<TMetrics> {
  return {
    status,
    source: meta && fetchedAt ? providerSource(meta, fetchedAt) : metrics ? 'derived' : 'none',
    stale: meta?.stale ?? false,
    lastUpdatedAt: fetchedAt ?? null,
    message,
    metrics,
  }
}

function createProviderError(
  statusCode: number,
  message: string,
  data?: unknown,
): Error & {
  statusCode: number
  data?: unknown
} {
  const error = new Error(message) as Error & { statusCode: number; data?: unknown }
  error.statusCode = statusCode
  if (data !== undefined) error.data = data
  return error
}

function mapProviderFailure(
  error: unknown,
): Pick<
  AnalyticsProviderSnapshot<never>,
  'status' | 'message' | 'source' | 'stale' | 'lastUpdatedAt'
> {
  const message = error instanceof Error ? error.message : 'Unknown provider error'
  const statusCode =
    typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode ?? 500)
      : 500

  if (
    message.includes('No property ID configured') ||
    message.includes('fleet registry has no') ||
    message.includes('No GA4 property ID configured')
  ) {
    return {
      status: 'missing_registry',
      message,
      source: 'none',
      stale: false,
      lastUpdatedAt: null,
    }
  }

  if (
    message.includes('not configured') ||
    message.includes('service account') ||
    message.includes('POSTHOG_PERSONAL_API_KEY') ||
    message.includes('POSTHOG_PROJECT_ID')
  ) {
    return {
      status: 'missing_config',
      message,
      source: 'none',
      stale: false,
      lastUpdatedAt: null,
    }
  }

  if (statusCode === 403) {
    return {
      status: 'access_denied',
      message,
      source: 'none',
      stale: false,
      lastUpdatedAt: null,
    }
  }

  return {
    status: 'error',
    message,
    source: 'none',
    stale: false,
    lastUpdatedAt: null,
  }
}

function hasGaData(metrics: FleetAnalyticsGaMetrics | null): boolean {
  if (!metrics) return false
  if (
    metrics.topPages.length > 0 ||
    metrics.topCountries.length > 0 ||
    metrics.topDevices.length > 0 ||
    metrics.topEvents.length > 0
  ) {
    return true
  }
  if (!metrics.summary) return false
  return (
    (metrics.summary.activeUsers ?? 0) > 0 ||
    (metrics.summary.screenPageViews ?? 0) > 0 ||
    (metrics.summary.eventCount ?? 0) > 0 ||
    metrics.timeSeries.length > 0
  )
}

function hasGscData(metrics: FleetAnalyticsGscMetrics | null): boolean {
  if (!metrics) return false
  const totals = metrics.totals
  return (
    !!totals &&
    ((totals.clicks ?? 0) > 0 ||
      (totals.impressions ?? 0) > 0 ||
      metrics.queries.length > 0 ||
      metrics.pages.length > 0 ||
      metrics.searchAppearances.length > 0 ||
      metrics.timeSeries.length > 0)
  )
}

function hasPosthogData(metrics: FleetAnalyticsPosthogMetrics | null): boolean {
  if (!metrics) return false
  return (
    Number(metrics.summary.event_count ?? 0) > 0 ||
    Number(metrics.summary.pageviews ?? 0) > 0 ||
    metrics.topEvents.length > 0 ||
    metrics.timeSeries.length > 0
  )
}

function getGaPreviousRange(range: AnalyticsRange) {
  const startMs = new Date(range.startDate).getTime()
  const endMs = new Date(range.endDate).getTime()
  const periodLength = Math.max(86_400_000, endMs - startMs + 86_400_000)
  const prevEndMs = startMs - 86_400_000
  const prevStartMs = prevEndMs - periodLength + 86_400_000
  return {
    prevStartDate: formatDate(new Date(prevStartMs)),
    prevEndDate: formatDate(new Date(prevEndMs)),
  }
}

export function parseAnalyticsQuery(event: H3Event): {
  startDate: string
  endDate: string
  force: boolean
} {
  const parsed = analyticsQuerySchema.safeParse(getQuery(event))
  const query = parsed.success ? parsed.data : {}
  const range = normalizeCalendarRange(query)
  return { ...range, force: query.force === 'true' }
}

export function parseAnalyticsFlexibleQuery(event: H3Event): {
  startDate: string
  endDate: string
  force: boolean
} {
  const parsed = analyticsQuerySchema.safeParse(getQuery(event))
  const query = parsed.success ? parsed.data : {}

  if (isTimestampInput(query.startDate) || isTimestampInput(query.endDate)) {
    const range = normalizeTimestampRange(query)
    return {
      startDate: range.start.toISOString(),
      endDate: range.end.toISOString(),
      force: query.force === 'true',
    }
  }

  const range = normalizeCalendarRange(query)
  return { ...range, force: query.force === 'true' }
}

export function parseAnalyticsAppParam(event: H3Event): string {
  const appSlug = getRouterParam(event, 'app')
  if (!appSlug) throw createProviderError(400, 'Missing app')
  return appSlug
}

export function toHttpError(error: unknown) {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const providerError = error as { statusCode?: number; message?: string; data?: unknown }
    return createH3Error({
      statusCode: providerError.statusCode ?? 500,
      message: providerError.message ?? 'Unexpected analytics error',
      data: providerError.data,
    })
  }

  return createH3Error({
    statusCode: 500,
    message: error instanceof Error ? error.message : 'Unexpected analytics error',
  })
}

async function executeGaCoreReport(
  propertyId: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return (await googleApiFetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    GA_SCOPES,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )) as Record<string, unknown>
}

async function executeGaRealtimeReport(
  propertyId: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return (await googleApiFetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`,
    GA_SCOPES,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )) as Record<string, unknown>
}

function computeGaDeltas(
  summary: GaSummary | null,
  previousTotals?: Array<{ value: string }>,
): GaDeltas | null {
  if (!summary || !previousTotals) return null

  const previous = {
    activeUsers: Number(previousTotals[0]?.value ?? 0),
    newUsers: Number(previousTotals[1]?.value ?? 0),
    sessions: Number(previousTotals[2]?.value ?? 0),
    screenPageViews: Number(previousTotals[3]?.value ?? 0),
    bounceRate: Number(previousTotals[4]?.value ?? 0),
    averageSessionDuration: Number(previousTotals[5]?.value ?? 0),
  }

  const pctChange = (current: number, prior: number) =>
    prior === 0 ? (current > 0 ? 100 : 0) : ((current - prior) / prior) * 100

  return {
    users: pctChange(summary.activeUsers, previous.activeUsers),
    sessions: pctChange(summary.sessions, previous.sessions),
    pageviews: pctChange(summary.screenPageViews, previous.screenPageViews),
    bounceRate: pctChange(summary.bounceRate, previous.bounceRate),
    avgSessionDuration: pctChange(summary.averageSessionDuration, previous.averageSessionDuration),
    newUsers: pctChange(summary.newUsers, previous.newUsers),
  }
}

function isGaRealtimeWindowError(error: unknown): boolean {
  if (!(error instanceof GoogleApiError)) return false
  const payload = JSON.stringify(error.body ?? '').toLowerCase()
  const message = error.message.toLowerCase()
  return (
    error.status === 400 &&
    (payload.includes('30 minutes') ||
      payload.includes('60 minutes') ||
      payload.includes('startminutesago') ||
      payload.includes('endminutesago') ||
      message.includes('minute'))
  )
}

function throwGaProviderError(error: unknown, propertyId: string, appName: string): never {
  if (error instanceof GoogleApiError) {
    if (error.status === 403) {
      throw createProviderError(
        403,
        `GA4: Service account does not have access to property ${propertyId} (${appName}). Grant analytics-admin@narduk-analytics.iam.gserviceaccount.com Viewer role in GA4 Admin → Property Access Management.`,
        error.body,
      )
    }

    if (
      error.message.includes('not configured') ||
      JSON.stringify(error.body ?? '').includes('not configured')
    ) {
      throw createProviderError(
        503,
        'GA4 not configured: set GSC_SERVICE_ACCOUNT_JSON and GA_PROPERTY_ID for fleet analytics.',
        error.body,
      )
    }

    throw createProviderError(error.status, `GA4 API error: ${error.message}`, error.body)
  }

  const message = error instanceof Error ? error.message : 'Unknown GA4 error'
  if (message.includes('not configured')) {
    throw createProviderError(
      503,
      'GA4 not configured: set GSC_SERVICE_ACCOUNT_JSON and GA_PROPERTY_ID for fleet analytics.',
    )
  }
  throw createProviderError(500, `GA4 unexpected error: ${message}`)
}

async function runGaRealtimeReport(
  app: FleetApp,
  propertyId: string,
  range: ReturnType<typeof normalizeTimestampRange>,
): Promise<Omit<FleetGAResponse, 'fetchedAt'>> {
  const requestedMinutes = Math.max(
    1,
    Math.ceil((range.end.getTime() - range.start.getTime()) / 60_000),
  )

  const fetchRealtimeWindow = async (minutesBack: number, note: string | null) => {
    const minuteRange = {
      startMinutesAgo: Math.max(minutesBack - 1, 0),
      endMinutesAgo: 0,
    }

    const [summaryData, seriesData, pagesData, countriesData, devicesData, eventsData] =
      await Promise.all([
        executeGaRealtimeReport(propertyId, {
          minuteRanges: [minuteRange],
          metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'eventCount' }],
        }),
        executeGaRealtimeReport(propertyId, {
          minuteRanges: [minuteRange],
          dimensions: [{ name: 'minutesAgo' }],
          metrics: [{ name: 'screenPageViews' }],
          orderBys: [{ dimension: { dimensionName: 'minutesAgo' } }],
          limit: minutesBack,
        }),
        executeGaRealtimeReport(propertyId, {
          minuteRanges: [minuteRange],
          dimensions: [{ name: 'unifiedScreenName' }],
          metrics: [{ name: 'screenPageViews' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 10,
        }),
        executeGaRealtimeReport(propertyId, {
          minuteRanges: [minuteRange],
          dimensions: [{ name: 'country' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
          limit: 10,
        }),
        executeGaRealtimeReport(propertyId, {
          minuteRanges: [minuteRange],
          dimensions: [{ name: 'deviceCategory' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
          limit: 10,
        }),
        executeGaRealtimeReport(propertyId, {
          minuteRanges: [minuteRange],
          dimensions: [{ name: 'eventName' }],
          metrics: [{ name: 'eventCount' }],
          orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
          limit: 10,
        }),
      ])

    const summaryMetrics =
      (summaryData.rows as Array<{ metricValues?: Array<{ value: string }> }> | undefined)?.[0]
        ?.metricValues ??
      (summaryData.totals as Array<{ metricValues?: Array<{ value: string }> }> | undefined)?.[0]
        ?.metricValues ??
      []

    return {
      app: app.name,
      propertyId,
      summary: {
        activeUsers: Number(summaryMetrics[0]?.value ?? 0),
        newUsers: 0,
        sessions: 0,
        screenPageViews: Number(summaryMetrics[1]?.value ?? 0),
        bounceRate: 0,
        averageSessionDuration: 0,
        engagedSessions: 0,
        engagementRate: 0,
        eventCount: Number(summaryMetrics[2]?.value ?? 0),
      },
      deltas: null,
      timeSeries: buildRealtimeSeries(
        range.end,
        minutesBack,
        (seriesData.rows as Array<{
          dimensionValues?: Array<{ value: string }>
          metricValues?: Array<{ value: string }>
        }>) ?? [],
      ),
      topPages: mapTopList(
        (pagesData.rows as Array<{
          dimensionValues?: Array<{ value: string }>
          metricValues?: Array<{ value: string }>
        }>) ?? [],
        'Untitled page',
      ),
      topCountries: mapTopList(
        (countriesData.rows as Array<{
          dimensionValues?: Array<{ value: string }>
          metricValues?: Array<{ value: string }>
        }>) ?? [],
        'Unknown country',
      ),
      topDevices: mapTopList(
        (devicesData.rows as Array<{
          dimensionValues?: Array<{ value: string }>
          metricValues?: Array<{ value: string }>
        }>) ?? [],
        'Unknown device',
      ),
      topEvents: mapTopList(
        (eventsData.rows as Array<{
          dimensionValues?: Array<{ value: string }>
          metricValues?: Array<{ value: string }>
        }>) ?? [],
        'Unknown event',
      ),
      note,
      startDate: range.start.toISOString(),
      endDate: range.end.toISOString(),
    }
  }

  const requestedWindow = Math.min(requestedMinutes, 60)
  try {
    return await fetchRealtimeWindow(requestedWindow, null)
  } catch (error) {
    if (requestedWindow > 30 && isGaRealtimeWindowError(error)) {
      return await fetchRealtimeWindow(
        30,
        'GA4 realtime on standard properties only exposes the freshest 30 minutes. Showing that live window instead of a full 60-minute rollup.',
      )
    }
    throw error
  }
}

async function runGaCoreReport(
  app: FleetApp,
  propertyId: string,
  range: AnalyticsRange,
): Promise<Omit<FleetGAResponse, 'fetchedAt'>> {
  const { prevStartDate, prevEndDate } = getGaPreviousRange(range)
  const hostname = new URL(app.url).hostname
  const isSingleDay = range.startDate === range.endDate
  const timeDimension = isSingleDay ? 'dateHour' : 'date'
  const dimensionFilter = {
    filter: {
      fieldName: 'hostName',
      inListFilter: {
        values: [hostname],
      },
    },
  }

  try {
    const [data, pagesData, countriesData, devicesData, eventsData] = await Promise.all([
      executeGaCoreReport(propertyId, {
        dateRanges: [
          { startDate: range.startDate, endDate: range.endDate, name: 'current' },
          { startDate: prevStartDate, endDate: prevEndDate, name: 'previous' },
        ],
        dimensions: [{ name: timeDimension }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'newUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
          { name: 'engagedSessions' },
          { name: 'engagementRate' },
          { name: 'eventCount' },
        ],
        metricAggregations: ['TOTAL'],
        dimensionFilter,
      }),
      executeGaCoreReport(propertyId, {
        dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
        dimensions: [{ name: 'unifiedPagePathScreen' }],
        metrics: [{ name: 'screenPageViews' }],
        dimensionFilter,
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10,
      }),
      executeGaCoreReport(propertyId, {
        dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'activeUsers' }],
        dimensionFilter,
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10,
      }),
      executeGaCoreReport(propertyId, {
        dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'activeUsers' }],
        dimensionFilter,
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10,
      }),
      executeGaCoreReport(propertyId, {
        dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter,
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 10,
      }),
    ])

    const totals = data.totals as Array<{ metricValues?: Array<{ value: string }> }> | undefined
    const rows = data.rows as
      | Array<{
          dimensionValues?: Array<{ value: string }>
          metricValues?: Array<{ value: string }>
        }>
      | undefined

    const timeSeries = (rows ?? [])
      .filter((row) => row.dimensionValues?.[0]?.value !== undefined)
      .filter((row) => {
        const dateStr = row.dimensionValues?.[0]?.value ?? ''
        if (isSingleDay) return dateStr.startsWith(range.startDate.replaceAll('-', ''))
        const cleaned = dateStr.length === 8 ? dateStr : dateStr.replaceAll('-', '')
        const start = range.startDate.replaceAll('-', '')
        const end = range.endDate.replaceAll('-', '')
        return cleaned >= start && cleaned <= end
      })
      .map((row) => {
        const dateStr = row.dimensionValues?.[0]?.value ?? ''
        let formattedDate = dateStr
        if (isSingleDay && dateStr.length === 10) {
          formattedDate = `${dateStr.slice(8, 10)}:00`
        } else if (dateStr.length === 8) {
          formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
        }
        return {
          date: formattedDate,
          value: Number(row.metricValues?.[3]?.value ?? 0),
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))

    const currentTotals = totals?.[0]?.metricValues
    const previousTotals = totals?.[1]?.metricValues

    const summary = currentTotals
      ? {
          activeUsers: Number(currentTotals[0]?.value ?? 0),
          newUsers: Number(currentTotals[1]?.value ?? 0),
          sessions: Number(currentTotals[2]?.value ?? 0),
          screenPageViews: Number(currentTotals[3]?.value ?? 0),
          bounceRate: Number(currentTotals[4]?.value ?? 0),
          averageSessionDuration: Number(currentTotals[5]?.value ?? 0),
          engagedSessions: Number(currentTotals[6]?.value ?? 0),
          engagementRate: Number(currentTotals[7]?.value ?? 0),
          eventCount: Number(currentTotals[8]?.value ?? 0),
        }
      : null

    return {
      app: app.name,
      propertyId,
      summary,
      deltas: computeGaDeltas(summary, previousTotals),
      timeSeries,
      topPages: mapTopList(
        (pagesData.rows as Array<{
          dimensionValues?: Array<{ value: string }>
          metricValues?: Array<{ value: string }>
        }>) ?? [],
        '/',
      ),
      topCountries: mapTopList(
        (countriesData.rows as Array<{
          dimensionValues?: Array<{ value: string }>
          metricValues?: Array<{ value: string }>
        }>) ?? [],
        'Unknown country',
      ),
      topDevices: mapTopList(
        (devicesData.rows as Array<{
          dimensionValues?: Array<{ value: string }>
          metricValues?: Array<{ value: string }>
        }>) ?? [],
        'Unknown device',
      ),
      topEvents: mapTopList(
        (eventsData.rows as Array<{
          dimensionValues?: Array<{ value: string }>
          metricValues?: Array<{ value: string }>
        }>) ?? [],
        'Unknown event',
      ),
      note: null,
      startDate: range.startDate,
      endDate: range.endDate,
    }
  } catch (error: unknown) {
    throwGaProviderError(error, propertyId, app.name)
  }
}

async function runGaReport(
  app: FleetApp,
  range: AnalyticsRange,
): Promise<Omit<FleetGAResponse, 'fetchedAt'>> {
  const propertyId = app.gaPropertyId
  if (!propertyId) {
    throw createProviderError(
      503,
      `GA4: No property ID configured for ${app.name}. Add it via the control plane at /fleet/manage.`,
    )
  }

  if (isTimestampRange(range)) {
    try {
      return await runGaRealtimeReport(app, propertyId, normalizeTimestampRange(range))
    } catch (error) {
      throwGaProviderError(error, propertyId, app.name)
    }
  }

  return await runGaCoreReport(app, propertyId, range)
}

async function tryGscQuery(
  siteUrl: string,
  range: AnalyticsRange,
  dimension: GscDimension,
): Promise<{
  dimensionalData: Record<string, unknown>
  totalData: Record<string, unknown> | null
  siteUrl: string
} | null> {
  const encoded = encodeURIComponent(siteUrl)
  try {
    const [dimensionalData, totalData] = await Promise.all([
      googleApiFetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`,
        GSC_SCOPES,
        {
          method: 'POST',
          body: JSON.stringify({
            startDate: range.startDate,
            endDate: range.endDate,
            dimensions: [dimension],
            rowLimit: dimension === 'query' ? 50 : 25,
          }),
        },
      ),
      googleApiFetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`,
        GSC_SCOPES,
        {
          method: 'POST',
          body: JSON.stringify({ startDate: range.startDate, endDate: range.endDate, rowLimit: 1 }),
        },
      ).catch(() => null),
    ])

    return {
      dimensionalData: dimensionalData as Record<string, unknown>,
      totalData: totalData as Record<string, unknown> | null,
      siteUrl,
    }
  } catch (error: unknown) {
    if (error instanceof GoogleApiError && (error.status === 403 || error.status === 404)) {
      return null
    }
    throw error
  }
}

async function tryGscSeries(siteUrl: string, range: AnalyticsRange) {
  const encoded = encodeURIComponent(siteUrl)
  try {
    const data = (await googleApiFetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`,
      GSC_SCOPES,
      {
        method: 'POST',
        body: JSON.stringify({
          startDate: range.startDate,
          endDate: range.endDate,
          dimensions: ['date'],
          rowLimit: 1000,
        }),
      },
    )) as Record<string, unknown>
    return { data, siteUrl }
  } catch (error: unknown) {
    if (error instanceof GoogleApiError && (error.status === 403 || error.status === 404)) {
      return null
    }
    throw error
  }
}

/** Minimal date range for GSC property probe (read-only). */
const GSC_PROPERTY_PROBE_RANGE: AnalyticsRange = {
  startDate: '2020-01-01',
  endDate: '2020-01-02',
}

/**
 * Resolve the Search Console property URL (domain or URL-prefix) that the service account can query.
 * Used for sitemap submission, which must target the same property string as the API.
 */
export async function resolveGscPropertySiteUrl(app: FleetApp): Promise<string | null> {
  const hostname = new URL(app.url).hostname
  const scDomain = `sc-domain:${hostname}`
  const urlPrefix = `${app.url.replace(/\/$/, '')}/`
  let result = await tryGscQuery(scDomain, GSC_PROPERTY_PROBE_RANGE, 'query')
  if (!result) result = await tryGscQuery(urlPrefix, GSC_PROPERTY_PROBE_RANGE, 'query')
  return result?.siteUrl ?? null
}

function mapGscSeriesRows(rows: Array<Record<string, unknown>>): GscSeriesPoint[] {
  return rows
    .map((row) => ({
      date: String((row.keys as string[] | undefined)?.[0] ?? ''),
      clicks: Number(row.clicks ?? 0),
      impressions: Number(row.impressions ?? 0),
      ctr: Number(row.ctr ?? 0),
      position: Number(row.position ?? 0),
    }))
    .filter((row) => row.date.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}

async function runGscQuery(
  app: FleetApp,
  range: AnalyticsRange,
  dimension: GscDimension,
): Promise<Omit<FleetGscResponse, 'fetchedAt'>> {
  const hostname = new URL(app.url).hostname
  const scDomain = `sc-domain:${hostname}`
  const urlPrefix = `${app.url.replace(/\/$/, '')}/`

  try {
    let result = await tryGscQuery(scDomain, range, dimension)
    const usedFallback = !result
    if (!result) result = await tryGscQuery(urlPrefix, range, dimension)

    if (!result) {
      throw createProviderError(
        403,
        `GSC: No access for '${scDomain}' or '${urlPrefix}'. Grant analytics-admin@narduk-analytics.iam.gserviceaccount.com access in Google Search Console.`,
      )
    }

    const rows = ((result.dimensionalData.rows as Array<Record<string, unknown>>) ?? []) as GscRow[]
    const totalsRow = (((result.totalData?.rows as Array<Record<string, unknown>> | undefined) ??
      [])[0] as GscTotals | undefined) ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 }

    let inspectionResult: GscInspection | null = null
    try {
      const inspectionData = (await googleApiFetch(
        'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
        GSC_SCOPES,
        {
          method: 'POST',
          body: JSON.stringify({
            inspectionUrl: app.url,
            siteUrl: result.siteUrl,
            languageCode: 'en-US',
          }),
        },
      )) as Record<string, unknown>

      inspectionResult = (inspectionData.inspectionResult as GscInspection | undefined) ?? null
    } catch {
      inspectionResult = null
    }

    return {
      app: app.name,
      rows,
      totals: totalsRow,
      inspection: inspectionResult,
      startDate: range.startDate,
      endDate: range.endDate,
      dimension,
      gscSiteUrl: result.siteUrl,
      note: usedFallback ? 'Using the URL-prefix Search Console property for this app.' : undefined,
    }
  } catch (error: unknown) {
    if (error instanceof GoogleApiError) {
      if (error.status === 403) {
        throw createProviderError(
          403,
          `GSC: No access for ${app.url}. Grant analytics-admin@narduk-analytics.iam.gserviceaccount.com access in Google Search Console.`,
          error.body,
        )
      }
      throw createProviderError(error.status, `GSC API error: ${error.message}`, error.body)
    }

    const message = error instanceof Error ? error.message : 'Unknown GSC error'
    if (message.includes('not configured')) {
      throw createProviderError(
        503,
        'GSC not configured: set GSC_SERVICE_ACCOUNT_JSON for fleet analytics.',
      )
    }
    throw error
  }
}

async function runGscSeries(
  app: FleetApp,
  range: AnalyticsRange,
): Promise<Omit<FleetGscSeriesResponse, 'fetchedAt'>> {
  const hostname = new URL(app.url).hostname
  const scDomain = `sc-domain:${hostname}`
  const urlPrefix = `${app.url.replace(/\/$/, '')}/`

  try {
    let result = await tryGscSeries(scDomain, range)
    if (!result) result = await tryGscSeries(urlPrefix, range)
    if (!result) {
      throw createProviderError(
        403,
        `GSC: No access for '${scDomain}' or '${urlPrefix}'. Grant analytics-admin@narduk-analytics.iam.gserviceaccount.com access in Google Search Console.`,
      )
    }

    const rows = ((result.data.rows as Array<Record<string, unknown>>) ?? []) as Array<
      Record<string, unknown>
    >
    return {
      app: app.name,
      timeSeries: mapGscSeriesRows(rows),
      startDate: range.startDate,
      endDate: range.endDate,
    }
  } catch (error: unknown) {
    if (error instanceof GoogleApiError) {
      if (error.status === 403) {
        throw createProviderError(
          403,
          `GSC: No access for ${app.url}. Grant analytics-admin@narduk-analytics.iam.gserviceaccount.com access in Google Search Console.`,
          error.body,
        )
      }
      throw createProviderError(error.status, `GSC API error: ${error.message}`, error.body)
    }

    const message = error instanceof Error ? error.message : 'Unknown GSC error'
    if (message.includes('not configured')) {
      throw createProviderError(
        503,
        'GSC not configured: set GSC_SERVICE_ACCOUNT_JSON for fleet analytics.',
      )
    }

    throw error
  }
}

async function runPosthogSummary(apps: FleetApp[]): Promise<FleetPosthogSummaryResponse['apps']> {
  const config = useRuntimeConfig()
  const apiKey = config.posthogApiKey
  const projectId = config.posthogProjectId
  const host = config.posthogHost || 'https://us.i.posthog.com'
  const internalUsersCohortId = config.posthogInternalUsersCohortId

  if (!apiKey || !projectId) {
    throw createProviderError(
      503,
      "PostHog not configured: set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID in the control plane's Doppler (prd).",
    )
  }

  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 30)
  const startISO = start.toISOString().slice(0, 19)
  const endISO = end.toISOString().slice(0, 19)

  const hostToAppMap = new Map<string, string>()
  for (const app of apps) {
    try {
      hostToAppMap.set(new URL(app.url).hostname, app.name)
    } catch {
      // Ignore invalid URLs in registry.
    }
  }

  const pageviewWhereClause = buildPosthogEventWhereClause({
    startISO,
    endISO,
    internalUsersCohortId,
    extraClauses: [
      "event = '$pageview'",
      'properties.$host IS NOT NULL',
      "properties.$host NOT LIKE '%localhost%'",
      "properties.$host NOT LIKE '%.local%'",
    ],
  })

  const hogqlQuery = `
    SELECT properties.$host AS app_host,
           count() AS pageviews,
           count(DISTINCT distinct_id) AS unique_users,
           count(DISTINCT properties.$session_id) AS sessions
    FROM events
    ${pageviewWhereClause}
    GROUP BY app_host
    ORDER BY pageviews DESC
  `

  const response = await fetch(`${host.replace(/\/$/, '')}/api/projects/${projectId}/query/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query: hogqlQuery } }),
    signal: AbortSignal.timeout(8_000),
  })

  if (!response.ok) {
    throw createProviderError(502, `PostHog API ${response.status}: ${await response.text()}`)
  }

  const data = (await response.json()) as { results?: (string | number | null)[][] }
  const result: FleetPosthogSummaryResponse['apps'] = {}
  for (const row of data.results ?? []) {
    const appHost = String(row[0] ?? '')
    const appName = hostToAppMap.get(appHost)
    if (!appName) continue
    const pageviews = Number(row[1] ?? 0)
    if (!result[appName]) {
      result[appName] = {
        eventCount: pageviews,
        users: Number(row[2] ?? 0),
        pageviews,
        sessions: Number(row[3] ?? 0),
        fetchedAt: new Date().toISOString(),
      }
    } else {
      result[appName].eventCount += pageviews
      result[appName].users += Number(row[2] ?? 0)
      result[appName].pageviews += pageviews
      result[appName].sessions += Number(row[3] ?? 0)
    }
  }

  return result
}

async function runPosthogReport(
  app: FleetApp,
  range: { start: Date; end: Date; startDate: string; endDate: string },
  summaryOnly: boolean,
): Promise<Omit<FleetPosthogResponse, 'fetchedAt'>> {
  const config = useRuntimeConfig()
  const apiKey = config.posthogApiKey
  const projectId = config.posthogProjectId
  const host = config.posthogHost || 'https://us.i.posthog.com'
  const internalUsersCohortId = config.posthogInternalUsersCohortId

  if (!apiKey || !projectId) {
    throw createProviderError(
      503,
      "PostHog not configured: set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID in the control plane's Doppler (prd).",
    )
  }

  const appHost = new URL(app.url).hostname
  const startISO = range.start.toISOString().slice(0, 19)
  const endISO = range.end.toISOString().slice(0, 19)
  const apiUrl = `${host.replace(/\/$/, '')}/api/projects/${projectId}/query/`

  const eventWhereClause = buildPosthogEventWhereClause({
    startISO,
    endISO,
    appHost,
    internalUsersCohortId,
  })

  const summaryQuery = `
    SELECT count() AS event_count,
           count(DISTINCT distinct_id) AS unique_users,
           countIf(event = '$pageview') AS pageviews,
           count(DISTINCT properties.$session_id) AS sessions
    FROM events
    ${eventWhereClause}
  `

  const fetchHogQL = async (query: string) => {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) {
      throw createProviderError(502, `PostHog API ${response.status}: ${await response.text()}`)
    }

    return (await response.json()) as { columns?: string[]; results?: (string | number | null)[][] }
  }

  const buildSummary = (data: { columns?: string[]; results?: (string | number | null)[][] }) => {
    const summaryRow = data.results?.[0] ?? []
    const summaryCols = data.columns ?? ['event_count', 'unique_users', 'pageviews', 'sessions']
    return summaryCols.reduce(
      (acc, column, index) => {
        acc[column] = Number(summaryRow[index] ?? 0)
        return acc
      },
      {} as Record<string, number>,
    )
  }

  if (summaryOnly) {
    const summaryData = await fetchHogQL(summaryQuery)
    return {
      app: app.name,
      summary: buildSummary(summaryData),
      timeSeries: [],
      topPages: [],
      topReferrers: [],
      topCountries: [],
      topBrowsers: [],
      topEvents: [],
      replaysUrl: '',
      startDate: range.startDate,
      endDate: range.endDate,
    }
  }

  const timeSeriesQuery = buildPosthogTimeSeriesQuery(
    eventWhereClause,
    classifyPosthogSeriesUnit(range),
  )

  const batchedTopQuery = `
    SELECT 'page' AS dimension, properties.$pathname AS name, count() AS cnt
    FROM events ${eventWhereClause} AND event = '$pageview' AND properties.$pathname IS NOT NULL
    GROUP BY name ORDER BY cnt DESC LIMIT 10

    UNION ALL

    SELECT 'referrer' AS dimension, properties.$referrer AS name, count() AS cnt
    FROM events ${eventWhereClause} AND event = '$pageview' AND properties.$referrer IS NOT NULL AND properties.$referrer != ''
    GROUP BY name ORDER BY cnt DESC LIMIT 10

    UNION ALL

    SELECT 'country' AS dimension, properties.$geoip_country_code AS name, count(DISTINCT distinct_id) AS cnt
    FROM events ${eventWhereClause} AND properties.$geoip_country_code IS NOT NULL
    GROUP BY name ORDER BY cnt DESC LIMIT 10

    UNION ALL

    SELECT 'browser' AS dimension, properties.$browser AS name, count(DISTINCT distinct_id) AS cnt
    FROM events ${eventWhereClause} AND properties.$browser IS NOT NULL
    GROUP BY name ORDER BY cnt DESC LIMIT 10

    UNION ALL

    SELECT 'event' AS dimension, event AS name, count() AS cnt
    FROM events ${eventWhereClause}
    GROUP BY name ORDER BY cnt DESC LIMIT 10
  `

  const [summaryData, timeSeriesData, batchedData] = await Promise.all([
    fetchHogQL(summaryQuery),
    fetchHogQL(timeSeriesQuery),
    fetchHogQL(batchedTopQuery),
  ])

  const batchedRows = batchedData.results ?? []
  const uiHost = host.includes('us.i.posthog.com')
    ? 'https://us.posthog.com'
    : 'https://eu.posthog.com'

  return {
    app: app.name,
    summary: buildSummary(summaryData),
    timeSeries: (timeSeriesData.results ?? []).map((row) => ({
      date: String(row[0]),
      value: Number(row[1] ?? 0),
    })),
    topPages: batchedRows
      .filter((row) => row[0] === 'page')
      .map((row) => ({ name: String(row[1] || '/'), count: Number(row[2] ?? 0) })),
    topReferrers: batchedRows
      .filter((row) => row[0] === 'referrer')
      .map((row) => ({ name: String(row[1] || 'Direct'), count: Number(row[2] ?? 0) })),
    topCountries: batchedRows
      .filter((row) => row[0] === 'country')
      .map((row) => ({ name: String(row[1] || 'Unknown'), count: Number(row[2] ?? 0) })),
    topBrowsers: batchedRows
      .filter((row) => row[0] === 'browser')
      .map((row) => ({ name: String(row[1] || 'Unknown'), count: Number(row[2] ?? 0) })),
    topEvents: batchedRows
      .filter((row) => row[0] === 'event')
      .map((row) => ({ name: String(row[1] || 'Unknown event'), count: Number(row[2] ?? 0) })),
    replaysUrl: `${uiHost}/project/${projectId}/replays?properties=[{"key":"$host","value":["${encodeURIComponent(appHost)}"],"operator":"exact","type":"event"}]`,
    startDate: range.startDate,
    endDate: range.endDate,
  }
}

export async function fetchGaEnvelope(
  event: H3Event,
  app: FleetApp,
  range: AnalyticsRange,
  force = false,
): Promise<ProviderEnvelope<FleetGAResponse>> {
  const cacheKey = `ga-app-${app.name}-${range.startDate}-${range.endDate}`
  const today = formatDate(new Date())
  const realtimeRange = isTimestampRange(range)
  const normalizedEndDate = realtimeRange
    ? new Date(range.endDate).toISOString().slice(0, 10)
    : range.endDate
  const isTodayRange = normalizedEndDate === today
  const ttlSeconds = realtimeRange ? 60 : isTodayRange ? 15 * 60 : 6 * 3600
  const staleWindowSeconds = realtimeRange ? 60 : isTodayRange ? 15 * 60 : 2 * 3600

  return (await withD1Cache(
    event,
    cacheKey,
    ttlSeconds,
    async () => ({
      ...(await runGaReport(app, range)),
      fetchedAt: new Date().toISOString(),
    }),
    force,
    { staleWindowSeconds, returnMeta: true },
  )) as ProviderEnvelope<FleetGAResponse>
}

export async function fetchGscEnvelope(
  event: H3Event,
  app: FleetApp,
  range: AnalyticsRange,
  dimension: GscDimension,
  force = false,
): Promise<ProviderEnvelope<FleetGscResponse>> {
  return (await withD1Cache(
    event,
    `gsc-app-${app.name}-${range.startDate}-${range.endDate}-${dimension}`,
    4 * 3600,
    async () => ({
      ...(await runGscQuery(app, range, dimension)),
      fetchedAt: new Date().toISOString(),
    }),
    force,
    { staleWindowSeconds: 2 * 3600, returnMeta: true },
  )) as ProviderEnvelope<FleetGscResponse>
}

export async function fetchGscSeriesEnvelope(
  event: H3Event,
  app: FleetApp,
  range: AnalyticsRange,
  force = false,
): Promise<ProviderEnvelope<FleetGscSeriesResponse>> {
  return (await withD1Cache(
    event,
    `gsc-series-${app.name}-${range.startDate}-${range.endDate}`,
    4 * 3600,
    async () => ({
      ...(await runGscSeries(app, range)),
      fetchedAt: new Date().toISOString(),
    }),
    force,
    { staleWindowSeconds: 2 * 3600, returnMeta: true },
  )) as ProviderEnvelope<FleetGscSeriesResponse>
}

export async function fetchPosthogEnvelope(
  event: H3Event,
  app: FleetApp,
  query: { startDate?: string; endDate?: string; summaryOnly?: boolean; force?: boolean },
): Promise<ProviderEnvelope<FleetPosthogResponse>> {
  const range = normalizeTimestampRange(query)
  const durationMs = range.end.getTime() - range.start.getTime()
  const ttlSeconds =
    durationMs <= 6 * 60 * 60 * 1000 ? 60 : durationMs <= 36 * 60 * 60 * 1000 ? 5 * 60 : 30 * 60
  const staleWindowSeconds = ttlSeconds
  return (await withD1Cache(
    event,
    `posthog-app-${ANALYTICS_CACHE_VERSION}-${app.name}-${query.summaryOnly ? 'summary' : 'full'}-${range.start.toISOString().slice(0, 19)}-${range.end.toISOString().slice(0, 19)}`,
    ttlSeconds,
    async () => ({
      ...(await runPosthogReport(app, range, query.summaryOnly ?? false)),
      fetchedAt: new Date().toISOString(),
    }),
    query.force ?? false,
    { staleWindowSeconds, returnMeta: true },
  )) as ProviderEnvelope<FleetPosthogResponse>
}

export async function fetchPosthogSummaryEnvelope(
  event: H3Event,
  apps: FleetApp[],
  force = false,
): Promise<ProviderEnvelope<FleetPosthogSummaryResponse>> {
  return (await withD1Cache(
    event,
    `posthog-summary-${ANALYTICS_CACHE_VERSION}`,
    5 * 60,
    async () => ({
      generatedAt: new Date().toISOString(),
      apps: await runPosthogSummary(apps),
    }),
    force,
    { staleWindowSeconds: 5 * 60, returnMeta: true },
  )) as ProviderEnvelope<FleetPosthogSummaryResponse>
}

async function getStatusMap(event: H3Event): Promise<Map<string, AppStatus>> {
  const db = useDatabase(event)
  const rows = await db.select().from(appStatus).all()
  return new Map(rows.map((row) => [row.app, row]))
}

function indexnowSnapshot(
  statusRecord?: AppStatus,
): AnalyticsProviderSnapshot<FleetAnalyticsIndexnowMetrics> {
  const metrics: FleetAnalyticsIndexnowMetrics = {
    lastSubmission: statusRecord?.indexnowLastSubmission ?? null,
    totalSubmissions: statusRecord?.indexnowTotalSubmissions ?? 0,
    lastSubmittedCount: statusRecord?.indexnowLastSubmittedCount ?? null,
  }

  const hasAnyIndexnow = metrics.lastSubmission !== null || metrics.totalSubmissions > 0
  return createProviderSnapshot(
    hasAnyIndexnow ? 'healthy' : 'no_data',
    metrics,
    hasAnyIndexnow
      ? 'Last ping from this dashboard succeeded. IndexNow only returns HTTP status from the engine (no clicks or impressions).'
      : 'No fleet ping recorded in this dashboard yet. Pings sent only inside each app are not tracked here—use Submit All or per-app IndexNow.',
    undefined,
    statusRecord?.checkedAt ?? null,
  )
}

function buildGaSnapshot(
  result: ProviderEnvelope<FleetGAResponse>,
): AnalyticsProviderSnapshot<FleetAnalyticsGaMetrics> {
  const metrics: FleetAnalyticsGaMetrics = {
    propertyId: result.data.propertyId,
    summary: result.data.summary,
    deltas: result.data.deltas,
    timeSeries: result.data.timeSeries,
    topPages: result.data.topPages ?? [],
    topCountries: result.data.topCountries ?? [],
    topDevices: result.data.topDevices ?? [],
    topEvents: result.data.topEvents ?? [],
    note: result.data.note ?? null,
  }

  if (result._meta.stale) {
    return createProviderSnapshot(
      'stale',
      metrics,
      'GA4 data is stale and is refreshing in the background.',
      result._meta,
      result.data.fetchedAt,
    )
  }

  return createProviderSnapshot(
    hasGaData(metrics) ? 'healthy' : 'no_data',
    metrics,
    hasGaData(metrics)
      ? metrics.note
      : (metrics.note ?? 'GA4 returned no traffic for the selected range.'),
    result._meta,
    result.data.fetchedAt,
  )
}

function buildGscSnapshot(
  queryResult: ProviderEnvelope<FleetGscResponse>,
  deviceResult: ProviderEnvelope<FleetGscResponse> | null,
  seriesResult: ProviderEnvelope<FleetGscSeriesResponse> | null,
): AnalyticsProviderSnapshot<FleetAnalyticsGscMetrics> {
  const metrics: FleetAnalyticsGscMetrics = {
    totals: queryResult.data.totals,
    queries: queryResult.data.rows,
    pages: [],
    devices: deviceResult?.data.rows ?? [],
    searchAppearances: [],
    timeSeries: seriesResult?.data.timeSeries ?? [],
    inspection: queryResult.data.inspection,
    siteUrl: queryResult.data.gscSiteUrl ?? null,
    note: queryResult.data.note ?? null,
  }

  const stale = queryResult._meta.stale || deviceResult?._meta.stale || seriesResult?._meta.stale
  const hasInspection = Boolean(metrics.inspection?.indexStatusResult)
  let message: string | null = metrics.note
  if (!seriesResult) {
    message = message ?? 'Search Console time series is unavailable for this app.'
  }

  return createProviderSnapshot(
    stale ? 'stale' : hasGscData(metrics) ? 'healthy' : 'no_data',
    metrics,
    stale
      ? 'Search Console data is stale and is refreshing in the background.'
      : hasGscData(metrics)
        ? message
        : hasInspection
          ? 'Search Console has indexing context for this app, but no clicks or impressions yet for the selected range.'
          : 'Search Console returned no clicks or impressions for the selected range.',
    queryResult._meta,
    queryResult.data.fetchedAt,
  )
}

function buildPosthogSnapshot(
  result: ProviderEnvelope<FleetPosthogResponse>,
): AnalyticsProviderSnapshot<FleetAnalyticsPosthogMetrics> {
  const metrics: FleetAnalyticsPosthogMetrics = {
    summary: result.data.summary,
    timeSeries: result.data.timeSeries ?? [],
    topPages: result.data.topPages ?? [],
    topReferrers: result.data.topReferrers ?? [],
    topCountries: result.data.topCountries ?? [],
    topBrowsers: result.data.topBrowsers ?? [],
    topEvents: result.data.topEvents ?? [],
    replaysUrl: result.data.replaysUrl ?? null,
  }

  return createProviderSnapshot(
    result._meta.stale ? 'stale' : hasPosthogData(metrics) ? 'healthy' : 'no_data',
    metrics,
    result._meta.stale
      ? 'PostHog data is stale and is refreshing in the background.'
      : hasPosthogData(metrics)
        ? null
        : 'PostHog returned no events for the selected range.',
    result._meta,
    result.data.fetchedAt,
  )
}

function emptyGaSnapshot(error: unknown): AnalyticsProviderSnapshot<FleetAnalyticsGaMetrics> {
  const failure = mapProviderFailure(error)
  return {
    ...failure,
    metrics: null,
  }
}

function emptyGscSnapshot(error: unknown): AnalyticsProviderSnapshot<FleetAnalyticsGscMetrics> {
  const failure = mapProviderFailure(error)
  return {
    ...failure,
    metrics: null,
  }
}

function emptyPosthogSnapshot(
  error: unknown,
): AnalyticsProviderSnapshot<FleetAnalyticsPosthogMetrics> {
  const failure = mapProviderFailure(error)
  return {
    ...failure,
    metrics: null,
  }
}

function buildTotals(apps: Record<string, FleetAnalyticsSnapshot>): FleetAnalyticsSummaryTotals {
  const totals: FleetAnalyticsSummaryTotals = {
    gaUsers: 0,
    gaPageviews: 0,
    gscClicks: 0,
    gscImpressions: 0,
    posthogEvents: 0,
    posthogUsers: 0,
    healthyProviders: { ga: 0, gsc: 0, posthog: 0, indexnow: 0 },
    problemProviders: { ga: 0, gsc: 0, posthog: 0, indexnow: 0 },
  }

  for (const snapshot of Object.values(apps)) {
    if (snapshot.ga.metrics?.summary) {
      totals.gaUsers += snapshot.ga.metrics.summary.activeUsers ?? 0
      totals.gaPageviews += snapshot.ga.metrics.summary.screenPageViews ?? 0
    }
    if (snapshot.gsc.metrics?.totals) {
      totals.gscClicks += snapshot.gsc.metrics.totals.clicks ?? 0
      totals.gscImpressions += snapshot.gsc.metrics.totals.impressions ?? 0
    }
    if (snapshot.posthog.metrics?.summary) {
      totals.posthogEvents += Number(snapshot.posthog.metrics.summary.event_count ?? 0)
      totals.posthogUsers += Number(snapshot.posthog.metrics.summary.unique_users ?? 0)
    }

    for (const provider of ['ga', 'gsc', 'posthog', 'indexnow'] as const) {
      if (snapshot[provider].status === 'healthy') {
        totals.healthyProviders[provider]++
      } else if (snapshot[provider].status !== 'no_data') {
        totals.problemProviders[provider]++
      }
    }
  }

  return totals
}

export function buildAnalyticsInsights(
  apps: Record<string, FleetAnalyticsSnapshot>,
): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = []
  const thresholdPct = 30

  for (const snapshot of Object.values(apps)) {
    const gaDeltas = snapshot.ga.metrics?.deltas
    const gscTotals = snapshot.gsc.metrics?.totals

    if (gaDeltas?.users !== undefined && Math.abs(gaDeltas.users) >= thresholdPct) {
      insights.push({
        type: gaDeltas.users > 0 ? 'spike' : 'drop',
        severity: Math.abs(gaDeltas.users) >= 50 ? 'warning' : 'info',
        appName: snapshot.app.name,
        message: `Users ${gaDeltas.users > 0 ? '+' : ''}${gaDeltas.users.toFixed(1)}% vs previous period`,
        metric: 'users',
        delta: gaDeltas.users,
      })
    }

    if (gaDeltas?.pageviews !== undefined && Math.abs(gaDeltas.pageviews) >= thresholdPct) {
      insights.push({
        type: gaDeltas.pageviews > 0 ? 'spike' : 'drop',
        severity: Math.abs(gaDeltas.pageviews) >= 50 ? 'warning' : 'info',
        appName: snapshot.app.name,
        message: `Pageviews ${gaDeltas.pageviews > 0 ? '+' : ''}${gaDeltas.pageviews.toFixed(1)}% vs previous period`,
        metric: 'pageviews',
        delta: gaDeltas.pageviews,
      })
    }

    if (gscTotals?.position !== undefined && gscTotals.position > 20) {
      insights.push({
        type: 'drop',
        severity: 'info',
        appName: snapshot.app.name,
        message: `Search position ${gscTotals.position.toFixed(1)} needs attention`,
        metric: 'position',
        currentValue: gscTotals.position,
      })
    }

    if (snapshot.ga.status === 'missing_registry') {
      insights.push({
        type: 'milestone',
        severity: 'critical',
        appName: snapshot.app.name,
        message: 'GA4 property is missing from the fleet registry.',
        metric: 'ga-config',
      })
    }

    if (snapshot.gsc.status === 'access_denied') {
      insights.push({
        type: 'drop',
        severity: 'warning',
        appName: snapshot.app.name,
        message: 'Search Console access is missing for the fleet service account.',
        metric: 'gsc-access',
      })
    }
  }

  return insights.sort((left, right) => {
    const severity = { critical: 3, warning: 2, info: 1 }
    return severity[right.severity] - severity[left.severity]
  })
}

export async function buildFleetAnalyticsSnapshot(
  event: H3Event,
  appOrSlug: FleetApp | string,
  range: AnalyticsRange,
  options: SnapshotBuildOptions = {},
): Promise<FleetAnalyticsDetailResponse> {
  const app = typeof appOrSlug === 'string' ? await getFleetAppByName(event, appOrSlug) : appOrSlug
  if (!app) throw createProviderError(404, 'App not found')

  const statusMap = await getStatusMap(event)
  const statusRecord = statusMap.get(app.name)
  const mode = options.mode ?? DETAIL_MODE
  const cacheKey = `fleet-analytics-app-${mode}-${ANALYTICS_CACHE_VERSION}-${app.name}-${range.startDate}-${range.endDate}`
  const { ttlSeconds, staleWindowSeconds } = snapshotCachePolicy(range)

  const response = await withD1Cache(
    event,
    cacheKey,
    ttlSeconds,
    async () => {
      const [gaResult, gscQueryResult, posthogResult] = await Promise.all([
        fetchGaEnvelope(event, app, range, options.force).catch((error) => error),
        fetchGscEnvelope(event, app, range, 'query', options.force).catch((error) => error),
        fetchPosthogEnvelope(event, app, {
          startDate: range.startDate,
          endDate: range.endDate,
          summaryOnly: mode === SUMMARY_MODE,
          force: options.force,
        }).catch((error) => error),
      ])

      let ga = emptyGaSnapshot(gaResult)
      if (!('statusCode' in (gaResult as object)) && '_meta' in (gaResult as object)) {
        ga = buildGaSnapshot(gaResult as ProviderEnvelope<FleetGAResponse>)
      }

      let gsc = emptyGscSnapshot(gscQueryResult)
      if (!('statusCode' in (gscQueryResult as object)) && '_meta' in (gscQueryResult as object)) {
        let gscDevice: ProviderEnvelope<FleetGscResponse> | null = null
        let gscSeries: ProviderEnvelope<FleetGscSeriesResponse> | null = null

        if (mode === DETAIL_MODE) {
          const [deviceResult, seriesResult] = await Promise.all([
            fetchGscEnvelope(event, app, range, 'device', options.force).catch(() => null),
            fetchGscSeriesEnvelope(event, app, range, options.force).catch(() => null),
          ])
          gscDevice = deviceResult
          gscSeries = seriesResult
        }

        gsc = buildGscSnapshot(
          gscQueryResult as ProviderEnvelope<FleetGscResponse>,
          gscDevice,
          gscSeries,
        )
      }

      let posthog = emptyPosthogSnapshot(posthogResult)
      if (!('statusCode' in (posthogResult as object)) && '_meta' in (posthogResult as object)) {
        posthog = buildPosthogSnapshot(posthogResult as ProviderEnvelope<FleetPosthogResponse>)
      }

      return {
        app: {
          name: app.name,
          url: app.url,
          dopplerProject: app.dopplerProject,
          gaPropertyId: app.gaPropertyId,
          gaMeasurementId: app.gaMeasurementId,
          posthogAppName: app.posthogAppName,
          githubRepo: app.githubRepo,
          isActive: app.isActive,
        },
        range,
        generatedAt: new Date().toISOString(),
        health: {
          status:
            statusRecord?.status === 'up'
              ? 'up'
              : statusRecord?.status === 'down'
                ? 'down'
                : 'unknown',
          checkedAt: statusRecord?.checkedAt ?? null,
        },
        ga,
        gsc,
        posthog,
        indexnow: indexnowSnapshot(statusRecord),
      } satisfies FleetAnalyticsDetailResponse
    },
    options.force ?? false,
    {
      staleWindowSeconds,
    },
  )

  return response as FleetAnalyticsDetailResponse
}

export async function buildFleetAnalyticsSummary(
  event: H3Event,
  range: AnalyticsRange,
  force = false,
): Promise<FleetAnalyticsSummaryResponse> {
  const { ttlSeconds, staleWindowSeconds } = summaryCachePolicy(range)
  const wrapped = (await withD1Cache(
    event,
    `fleet-analytics-summary-${ANALYTICS_CACHE_VERSION}-${range.startDate}-${range.endDate}`,
    ttlSeconds,
    async () => {
      const apps = await getFleetApps(event)
      const snapshots = await Promise.all(
        // eslint-disable-next-line narduk/no-map-async-in-server -- bounded parallel analytics hydration across the fleet
        apps.map(async (app) => [
          app.name,
          await buildFleetAnalyticsSnapshot(event, app, range, { force, mode: SUMMARY_MODE }),
        ]),
      )

      const appMap = Object.fromEntries(snapshots) as Record<string, FleetAnalyticsSnapshot>
      return {
        startDate: range.startDate,
        endDate: range.endDate,
        generatedAt: new Date().toISOString(),
        apps: appMap,
        totals: buildTotals(appMap),
        insights: buildAnalyticsInsights(appMap),
      } satisfies FleetAnalyticsSummaryResponse
    },
    force,
    { staleWindowSeconds, returnMeta: true },
  )) as { data: FleetAnalyticsSummaryResponse; _meta: AnalyticsCacheMeta }

  return {
    ...wrapped.data,
    _meta: wrapped._meta,
  }
}

export async function buildIntegrationHealth(
  event: H3Event,
): Promise<FleetIntegrationHealthResponse> {
  const config = useRuntimeConfig()
  const apps = await getFleetApps(event)

  const services: FleetIntegrationHealthCheck[] = [
    {
      key: 'google_service_account',
      label: 'Google service account',
      status: config.googleServiceAccountKey ? 'configured' : 'missing',
      message: config.googleServiceAccountKey
        ? 'Service account JSON is configured for GA4 and Search Console.'
        : 'Set GSC_SERVICE_ACCOUNT_JSON to enable GA4 and Search Console access.',
    },
    {
      key: 'ga_account_id',
      label: 'GA account',
      status: config.gaAccountId ? 'configured' : 'missing',
      message: config.gaAccountId
        ? 'GA account ID is configured for provisioning.'
        : 'Set GA_ACCOUNT_ID to provision new GA4 properties.',
    },
    {
      key: 'posthog',
      label: 'PostHog API',
      status:
        config.posthogApiKey && config.posthogProjectId
          ? 'configured'
          : config.posthogApiKey || config.posthogProjectId
            ? 'partial'
            : 'missing',
      message:
        config.posthogApiKey && config.posthogProjectId
          ? 'PostHog personal API key and project ID are configured.'
          : 'Set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID to fetch PostHog analytics.',
    },
  ]

  const d1 = getD1CacheDB(event)
  let lastSnapshotAt: string | null = null
  if (d1) {
    const rows = await d1
      .prepare(
        "SELECT value FROM kv_cache WHERE key LIKE 'fleet-analytics-app-summary-%' ORDER BY expires_at DESC LIMIT 25",
      )
      .all<{ value: string }>()

    for (const row of rows.results ?? []) {
      try {
        const parsed = JSON.parse(row.value) as { generatedAt?: string }
        if (parsed.generatedAt && (!lastSnapshotAt || parsed.generatedAt > lastSnapshotAt)) {
          lastSnapshotAt = parsed.generatedAt
        }
      } catch {
        // Ignore malformed cache rows.
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    lastSnapshotAt,
    fleet: {
      totalApps: apps.length,
      appsWithGaPropertyId: apps.filter((app) => !!app.gaPropertyId).length,
      appsWithGaMeasurementId: apps.filter((app) => !!app.gaMeasurementId).length,
      appsWithPosthogAppName: apps.filter((app) => !!app.posthogAppName).length,
    },
    services,
  }
}

export async function reconcileAuditMeasurementIds(
  event: H3Event,
  updates: Array<{ app: string; gaMeasurementId: string }>,
): Promise<number> {
  if (updates.length === 0) return 0

  const db = useDatabase(event)
  let updated = 0

  for (const item of updates) {
    await db
      .update(fleetApps)
      .set({
        gaMeasurementId: item.gaMeasurementId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(fleetApps.name, item.app))
    updated++
  }

  if (updated > 0) {
    await invalidateFleetAppListCache(event)
  }

  return updated
}
