import { storeToRefs } from 'pinia'
import type { AnalyticsSurface } from '~/utils/analyticsPresentation'
import type {
  FleetAnalyticsGaMetrics,
  FleetAnalyticsGscMetrics,
  FleetAnalyticsPosthogMetrics,
  GscQueryParams,
} from '~/types/analytics'
import { useAnalyticsStore } from '~/stores/analytics'

export function useAnalyticsAppSurfaceData(
  appName: MaybeRefOrGetter<string>,
  currentSurface: MaybeRefOrGetter<AnalyticsSurface>,
) {
  const analyticsStore = useAnalyticsStore()
  const { preset, startDate, endDate } = storeToRefs(analyticsStore)

  const name = computed(() => toValue(appName))
  const surface = computed(() => toValue(currentSurface))
  const forceReload = ref(false)

  const gaRequest = useFleetGA(name, startDate, endDate, forceReload)
  const posthogRequest = useFleetPosthog(name, startDate, endDate, forceReload)

  const gscBaseParams = computed<GscQueryParams>(() => ({
    startDate: startDate.value,
    endDate: endDate.value,
    force: forceReload.value,
    dimension: 'query',
  }))

  const gscQuery = useFleetGscQuery(
    name,
    computed(() => ({ ...gscBaseParams.value, dimension: 'query' })),
  )
  const gscPages = useFleetGscQuery(
    name,
    computed(() => ({ ...gscBaseParams.value, dimension: 'page' })),
  )
  const gscDevices = useFleetGscQuery(
    name,
    computed(() => ({ ...gscBaseParams.value, dimension: 'device' })),
  )
  const gscSearchAppearance = useFleetGscQuery(
    name,
    computed(() => ({ ...gscBaseParams.value, dimension: 'searchAppearance' })),
  )
  const gscSeries = useFleetGscSeries(name, startDate, endDate, { force: forceReload })

  function newestTimestamp(...timestamps: Array<string | null | undefined>) {
    const latestMs = timestamps.reduce<number | null>((current, timestamp) => {
      if (!timestamp) return current
      const next = new Date(timestamp).getTime()
      if (Number.isNaN(next)) return current
      return current == null ? next : Math.max(current, next)
    }, null)

    return latestMs == null ? null : new Date(latestMs).toISOString()
  }

  const gaMetrics = computed<FleetAnalyticsGaMetrics | null>(() => {
    const data = gaRequest.data.value
    if (!data) return null
    return {
      propertyId: data.propertyId,
      summary: data.summary,
      deltas: data.deltas,
      timeSeries: data.timeSeries ?? [],
      topPages: data.topPages ?? [],
      topCountries: data.topCountries ?? [],
      topDevices: data.topDevices ?? [],
      topEvents: data.topEvents ?? [],
      note: data.note ?? null,
    }
  })

  const posthogMetrics = computed<FleetAnalyticsPosthogMetrics | null>(() => {
    const data = posthogRequest.data.value
    if (!data) return null
    return {
      summary: data.summary,
      timeSeries: data.timeSeries ?? [],
      topPages: data.topPages ?? [],
      topReferrers: data.topReferrers ?? [],
      topCountries: data.topCountries ?? [],
      topBrowsers: data.topBrowsers ?? [],
      topEvents: data.topEvents ?? [],
      replaysUrl: data.replaysUrl ?? null,
    }
  })

  const gscMetrics = computed<FleetAnalyticsGscMetrics | null>(() => {
    const queryData = gscQuery.data.value
    const pageData = gscPages.data.value
    const deviceData = gscDevices.data.value
    const appearanceData = gscSearchAppearance.data.value
    const seriesData = gscSeries.data.value

    if (!queryData && !pageData && !deviceData && !appearanceData && !seriesData) {
      return null
    }

    return {
      totals: queryData?.totals ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      queries: queryData?.rows ?? [],
      pages: pageData?.rows ?? [],
      devices: deviceData?.rows ?? [],
      searchAppearances: appearanceData?.rows ?? [],
      timeSeries: seriesData?.timeSeries ?? [],
      inspection: queryData?.inspection ?? null,
      siteUrl: queryData?.gscSiteUrl ?? null,
      note: queryData?.note ?? null,
    }
  })

  const surfaceBlocksSelectedRange = computed(() => {
    if (preset.value !== '1h') return false
    return surface.value === 'overview' || surface.value === 'gsc'
  })

  const blockedRangeMessage = computed(() => {
    if (!surfaceBlocksSelectedRange.value) return null
    if (surface.value === 'gsc') {
      return {
        title: 'Last hour is not supported for Search Console app detail',
        description:
          'Search Console performance and indexing data do not update on a live minute-by-minute cadence here. Switch to Today or a longer range.',
      }
    }
    return {
      title: 'Last hour is not supported for canonical analytics snapshots',
      description:
        'Use the GA4 or PostHog tabs for live activity. Overview snapshots still rely on slower provider rollups.',
    }
  })

  const currentLoading = computed(() => {
    switch (surface.value) {
      case 'ga':
        return gaRequest.loading.value
      case 'gsc':
        return (
          gscQuery.loading.value ||
          gscPages.loading.value ||
          gscDevices.loading.value ||
          gscSearchAppearance.loading.value ||
          gscSeries.loading.value
        )
      case 'posthog':
        return posthogRequest.loading.value
      default:
        return false
    }
  })

  const currentError = computed(() => {
    switch (surface.value) {
      case 'ga':
        return gaRequest.error.value
      case 'gsc':
        return gscQuery.error.value
      case 'posthog':
        return posthogRequest.error.value
      default:
        return null
    }
  })

  const currentFetchedAt = computed(() => {
    switch (surface.value) {
      case 'ga':
        return gaRequest.data.value?.fetchedAt ?? null
      case 'gsc':
        return newestTimestamp(
          gscQuery.data.value?.fetchedAt,
          gscPages.data.value?.fetchedAt,
          gscDevices.data.value?.fetchedAt,
          gscSearchAppearance.data.value?.fetchedAt,
          gscSeries.data.value?.fetchedAt,
        )
      case 'posthog':
        return posthogRequest.data.value?.fetchedAt ?? null
      default:
        return null
    }
  })

  async function loadGa() {
    await gaRequest.load()
  }

  async function loadPosthog() {
    await posthogRequest.load()
  }

  async function loadGsc() {
    await Promise.all([
      gscQuery.load(),
      gscPages.load().catch(() => null),
      gscDevices.load().catch(() => null),
      gscSearchAppearance.load().catch(() => null),
      gscSeries.load().catch(() => null),
    ])
  }

  async function loadCurrentSurface(force = false) {
    if (!name.value || surfaceBlocksSelectedRange.value) return

    forceReload.value = force
    try {
      switch (surface.value) {
        case 'ga':
          await loadGa()
          return
        case 'gsc':
          await loadGsc()
          return
        case 'posthog':
          await loadPosthog()
          return
        default:
      }
    } finally {
      forceReload.value = false
    }
  }

  watch(
    [name, surface, preset, startDate, endDate],
    () => {
      void loadCurrentSurface()
    },
    { immediate: true },
  )

  let visibilityTimer: ReturnType<typeof setTimeout> | undefined

  function onVisibility() {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
    if (!name.value || surfaceBlocksSelectedRange.value) return
    if (visibilityTimer) clearTimeout(visibilityTimer)
    visibilityTimer = setTimeout(() => {
      void loadCurrentSurface()
    }, 800)
  }

  onMounted(() => {
    if (import.meta.client) {
      document.addEventListener('visibilitychange', onVisibility)
    }
  })

  onUnmounted(() => {
    if (visibilityTimer) clearTimeout(visibilityTimer)
    if (import.meta.client) {
      document.removeEventListener('visibilitychange', onVisibility)
    }
  })

  async function refreshCurrentSurface() {
    await loadCurrentSurface(true)
  }

  return {
    gaMetrics,
    posthogMetrics,
    gscMetrics,
    currentLoading,
    currentError,
    currentFetchedAt,
    surfaceBlocksSelectedRange,
    blockedRangeMessage,
    refreshCurrentSurface,
  }
}
