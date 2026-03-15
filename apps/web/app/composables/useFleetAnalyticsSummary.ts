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

function isMetaResponse<T>(
  r: T | { data: T; _meta: FleetAnalyticsSummaryMeta },
): r is { data: T; _meta: FleetAnalyticsSummaryMeta } {
  return typeof r === 'object' && r !== null && 'data' in r && '_meta' in r
}

const CLIENT_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

// Module-scope cache for tracking when each key was last fetched
const fetchTimestamps = new Map<string, number>()

export function useFleetAnalyticsSummary(
  startDate: MaybeRefOrGetter<string>,
  endDate: MaybeRefOrGetter<string>,
  options?: { force?: MaybeRefOrGetter<boolean> },
) {
  const query = computed(() => ({
    startDate: toValue(startDate),
    endDate: toValue(endDate),
    // eslint-disable-next-line narduk/no-composable-conditional-hooks -- false positive: toValue(options?.force) is not conditional
    ...(toValue(options?.force) ? { force: 'true' } : {}),
  }))

  // Unique key for client-side Nuxt payload cache based on date range
  const fetchKey = computed(
    () => `fleet-analytics-summary-${toValue(startDate)}-${toValue(endDate)}`,
  )

  const {
    data: rawData,
    status,
    error,
    refresh,
  } = useFetch<
    | FleetAnalyticsSummaryResponse
    | { data: FleetAnalyticsSummaryResponse; _meta: FleetAnalyticsSummaryMeta }
  >('/api/fleet/analytics/summary', {
    query,
    key: fetchKey,
    lazy: true,
    server: false,
    watch: false,
    getCachedData(key, nuxtApp) {
      const cached = nuxtApp.payload.data[key] || nuxtApp.static.data[key]
      if (!cached) return
      const fetchedAt = fetchTimestamps.get(key)
      if (fetchedAt && Date.now() - fetchedAt < CLIENT_CACHE_TTL) {
        return cached
      }
      // Data is stale — don't return it so useFetch re-fetches
    },
  })

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
    fetchTimestamps.set(fetchKey.value, Date.now())
  }

  // Auto-refresh every 5 minutes while component is mounted
  let refreshTimer: ReturnType<typeof setInterval> | undefined

  onMounted(() => {
    refreshTimer = setInterval(() => {
      if (!loading.value) {
        load()
      }
    }, AUTO_REFRESH_INTERVAL)
  })

  onUnmounted(() => {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = undefined
    }
  })

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
