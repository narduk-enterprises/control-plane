import type { MaybeRefOrGetter } from 'vue'

export interface FleetAppAnalyticsSummary {
  ga: {
    summary: { activeUsers?: number; screenPageViews?: number; sessions?: number } | null
    deltas: { users?: number; pageviews?: number; sessions?: number } | null
    timeSeries: { date: string; value: number }[]
  } | null
  gsc: {
    totals: { clicks?: number; impressions?: number; ctr?: number; position?: number } | null
    rowsCount: number
  } | null
  posthog: {
    summary: Record<string, number>
    timeSeries: { date: string; value: number }[]
  } | null
}

export interface FleetAnalyticsSummaryResponse {
  apps: Record<string, FleetAppAnalyticsSummary>
  startDate: string
  endDate: string
}

export interface FleetAnalyticsSummaryMeta {
  cachedAt: string
  stale: boolean
}

function isMetaResponse<T>(r: T | { data: T; _meta: FleetAnalyticsSummaryMeta }): r is { data: T; _meta: FleetAnalyticsSummaryMeta } {
  return typeof r === 'object' && r !== null && 'data' in r && '_meta' in r
}

export function useFleetAnalyticsSummary(
  startDate: MaybeRefOrGetter<string>,
  endDate: MaybeRefOrGetter<string>,
  options?: { force?: MaybeRefOrGetter<boolean> },
) {
  const query = computed(() => ({
    startDate: toValue(startDate),
    endDate: toValue(endDate),
    // eslint-disable-next-line vue-official/no-composable-conditional-hooks -- false positive: toValue(options?.force) is not conditional
    ...(toValue(options?.force) ? { force: 'true' } : {}),
  }))

  const { data: rawData, status, error, refresh } = useFetch<FleetAnalyticsSummaryResponse | { data: FleetAnalyticsSummaryResponse; _meta: FleetAnalyticsSummaryMeta }>(
    '/api/fleet/analytics/summary',
    {
      query,
      lazy: true,
      server: false,
      watch: false,
    },
  )

  const data = computed(() => {
    const r = rawData.value
    if (!r) return null
    return isMetaResponse(r) ? r.data : r
  })

  const meta = computed(() => {
    const r = rawData.value
    if (!r || !isMetaResponse(r)) return null
    return r._meta
  })

  const loading = computed(() => status.value === 'pending')

  async function load() {
    await refresh()
  }

  return {
    data,
    meta,
    loading,
    status,
    error,
    load,
    refresh,
  }
}
