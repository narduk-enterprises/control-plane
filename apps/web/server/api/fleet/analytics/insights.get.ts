import { z } from 'zod'
import { getRequestURL, getRequestHeaders } from 'h3'
import { withD1Cache } from '#server/utils/d1-cache'
import type { FleetAppAnalyticsSummary } from './summary.get'

const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  force: z.enum(['true', 'false']).optional(),
})

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

function buildInsights(apps: Record<string, FleetAppAnalyticsSummary>): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = []
  const THRESHOLD_PCT = 30

  for (const [appName, data] of Object.entries(apps)) {
    if (data.ga?.deltas) {
      const d = data.ga.deltas
      if (d.users !== undefined && Math.abs(d.users) >= THRESHOLD_PCT) {
        insights.push({
          type: d.users > 0 ? 'spike' : 'drop',
          severity: Math.abs(d.users) >= 50 ? 'warning' : 'info',
          appName,
          message: `Users ${d.users > 0 ? '+' : ''}${d.users.toFixed(1)}% vs previous period`,
          metric: 'users',
          delta: d.users,
        })
      }
      if (d.pageviews !== undefined && Math.abs(d.pageviews) >= THRESHOLD_PCT) {
        insights.push({
          type: d.pageviews > 0 ? 'spike' : 'drop',
          severity: Math.abs(d.pageviews) >= 50 ? 'warning' : 'info',
          appName,
          message: `Pageviews ${d.pageviews > 0 ? '+' : ''}${d.pageviews.toFixed(1)}% vs previous period`,
          metric: 'pageviews',
          delta: d.pageviews,
        })
      }
    }
    if (data.gsc?.totals?.position !== undefined && data.gsc.totals.position > 20) {
      insights.push({
        type: 'drop',
        severity: 'info',
        appName,
        message: `GSC average position ${data.gsc.totals.position.toFixed(1)} — consider improving SEO`,
        metric: 'position',
        currentValue: data.gsc.totals.position,
      })
    }
  }

  // Fleet-level: rank apps by growth for "Best performing" / "Needs attention"
  const withUserDelta = Object.entries(apps)
    .map(([name, data]) => ({ name, delta: data.ga?.deltas?.users ?? 0 }))
    .sort((a, b) => b.delta - a.delta)
  const leader = withUserDelta[0]
  if (leader && withUserDelta.length > 0 && leader.delta >= THRESHOLD_PCT) {
    insights.push({
      type: 'spike',
      severity: 'info',
      appName: leader.name,
      message: `${leader.name} leads growth with +${leader.delta.toFixed(1)}% users`,
      metric: 'users',
      delta: leader.delta,
    })
  }
  const decliner = withUserDelta.filter((x) => x.delta < -THRESHOLD_PCT)[0]
  if (decliner) {
    insights.push({
      type: 'drop',
      severity: Math.abs(decliner.delta) >= 50 ? 'warning' : 'info',
      appName: decliner.name,
      message: `${decliner.name} users down ${decliner.delta.toFixed(1)}% vs previous period`,
      metric: 'users',
      delta: decliner.delta,
    })
  }

  return insights.sort((a, b) => {
    const sev = { critical: 3, warning: 2, info: 1 }
    return (sev[b.severity as keyof typeof sev] ?? 0) - (sev[a.severity as keyof typeof sev] ?? 0)
  })
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const cronHeader = getHeader(event, 'x-internal-cron')
  if (!(config.cronSecret && cronHeader === config.cronSecret)) {
    await requireAdmin(event)
  }
  await enforceRateLimit(event, 'fleet-analytics-insights', 30, 60_000)

  const query = querySchema.safeParse(getQuery(event))
  const parsed = query.success ? query.data : {}
  let endDate = parsed.endDate ?? new Date().toISOString().split('T')[0] ?? ''
  const startObj = new Date(endDate)
  startObj.setDate(startObj.getDate() - 30)
  let startDate = parsed.startDate ?? startObj.toISOString().split('T')[0] ?? ''
  if (startDate > endDate) {
    const t = startDate
    startDate = endDate
    endDate = t
  }

  const cacheKey = `fleet-analytics-insights-${startDate}-${endDate}`
  const TTL = 30 * 60

  const STALE_WINDOW = 30 * 60
  return withD1Cache(event, cacheKey, TTL, async () => {
    const baseURL = getRequestURL(event).origin
    const headers = getRequestHeaders(event)
    const authHeaders: Record<string, string> = {}
    if (headers.cookie) authHeaders.cookie = headers.cookie
    if (headers.authorization) authHeaders.authorization = headers.authorization
    if (headers['x-requested-with']) authHeaders['x-requested-with'] = headers['x-requested-with']

    const raw = await $fetch<{ apps?: Record<string, FleetAppAnalyticsSummary> } | { data: { apps?: Record<string, FleetAppAnalyticsSummary> } }>(
      `/api/fleet/analytics/summary?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
      { baseURL, headers: authHeaders },
    )
    const data = raw && typeof raw === 'object' && 'data' in raw && raw.data ? (raw as { data: { apps?: Record<string, FleetAppAnalyticsSummary> } }).data : (raw as { apps?: Record<string, FleetAppAnalyticsSummary> })
    const apps = data?.apps ?? {}
    return { insights: buildInsights(apps), startDate, endDate }
  }, parsed.force === 'true', { staleWindowSeconds: STALE_WINDOW })
})
