import { storeToRefs } from 'pinia'
import { useAnalyticsStore } from '~/stores/analytics'

export interface UseAnalyticsHubOptions {
  /**
   * When false, skip fleet analytics summary fetches (e.g. IndexNow-only tab).
   * Cached store data is left intact for when this becomes true again.
   */
  loadFleetSnapshots?: MaybeRefOrGetter<boolean>
  /**
   * Integration health powers the overview “Server integrations” card only.
   * Defaults to the same value as `loadFleetSnapshots` when omitted.
   */
  loadIntegrationHealth?: MaybeRefOrGetter<boolean>
}

/**
 * Orchestrates fleet analytics hub data: range, summary load, background revalidate, integration health.
 * Pages stay thin; the Pinia store holds cached summaries.
 */
export function useAnalyticsHub(options: UseAnalyticsHubOptions = {}) {
  const loadFleetSnapshotsRef = computed(() => toValue(options.loadFleetSnapshots ?? true))
  const loadIntegrationHealthRef = computed(() => {
    if (options.loadIntegrationHealth !== undefined) {
      // eslint-disable-next-line narduk/no-composable-conditional-hooks -- false positive: toValue unwraps Ref/getter from options, not a conditional composable
      return toValue(options.loadIntegrationHealth)
    }
    return loadFleetSnapshotsRef.value
  })

  const analyticsStore = useAnalyticsStore()
  const { preset, startDate, endDate } = storeToRefs(analyticsStore)
  const dateState = useAnalyticsDateRange('30d')

  const { apps: fleetApps, getAppStatus, refreshStatusesRaw } = useFleet()

  const { data: indexnowSummary, refresh: refreshIndexnowSummary } = useFleetIndexnowSummary()
  const { submitting: indexnowSubmitting, submitAll: submitAllIndexnow } =
    useBatchIndexnow(fleetApps)
  const { data: gscSitemapSummary, refresh: refreshGscSitemapSummary } = useFleetGscSitemapSummary()
  const { submitting: gscSitemapSubmitting, submitAll: submitAllGscSitemap } =
    useBatchGscSitemap(fleetApps)

  const range = computed(() => ({ startDate: startDate.value, endDate: endDate.value }))

  const summary = computed(() => analyticsStore.getSummary(range.value))
  const snapshotMap = computed(() => summary.value?.apps ?? {})
  const summaryLoading = computed(() => analyticsStore.getSummaryStatus(range.value) === 'pending')
  const summaryError = computed(() => analyticsStore.getSummaryError(range.value))
  const insights = computed(() => analyticsStore.getInsights(range.value))
  const summaryRevalidating = computed(() => analyticsStore.isSummaryRevalidating(range.value))
  const summaryMeta = computed(() => analyticsStore.getSummaryMeta(range.value))
  const serverStale = computed(() => summaryMeta.value?.stale === true)

  const freshness = computed(() => {
    const generatedAt = summary.value?.generatedAt
    if (!generatedAt) return null
    const diffMinutes = Math.round((Date.now() - new Date(generatedAt).getTime()) / 60_000)
    if (diffMinutes < 1) return 'Updated just now'
    if (diffMinutes < 60) return `Updated ${diffMinutes} min ago`
    return `Updated ${new Date(generatedAt).toLocaleTimeString()}`
  })

  async function loadSummary(force = false, background = false) {
    if (preset.value === '1h') return
    await analyticsStore.fetchSummary({ range: range.value, force, background })
  }

  async function refreshAll() {
    await Promise.all([
      analyticsStore.fetchSummary({ range: range.value, force: true, background: true }),
      analyticsStore.fetchIntegrationHealth(true),
      refreshStatusesRaw(),
    ])
  }

  /** Explicit refresh for Fleet Health + integration cards (blocking UI pending state). */
  async function refreshFleetHealth() {
    if (preset.value === '1h') return
    await Promise.all([
      analyticsStore.fetchSummary({ range: range.value, force: true, background: false }),
      analyticsStore.fetchIntegrationHealth(true),
    ])
  }

  async function batchSubmitIndexnow(): Promise<{ ok: number; fail: number }> {
    const counts = await submitAllIndexnow()
    await refreshIndexnowSummary()
    return counts
  }

  async function batchSubmitGscSitemap(): Promise<{ ok: number; fail: number }> {
    const counts = await submitAllGscSitemap()
    await refreshGscSitemapSummary()
    return counts
  }

  function loadFleetDataIfNeeded() {
    if (preset.value === '1h') return
    if (loadFleetSnapshotsRef.value) {
      void loadSummary(false, false)
    }
    if (loadIntegrationHealthRef.value) {
      void analyticsStore.fetchIntegrationHealth()
    }
  }

  watch(
    [loadFleetSnapshotsRef, loadIntegrationHealthRef, startDate, endDate, preset],
    () => {
      loadFleetDataIfNeeded()
    },
    { immediate: true },
  )

  let visibilityTimer: ReturnType<typeof setTimeout> | undefined

  function onVisibility() {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
    if (preset.value === '1h' || !loadFleetSnapshotsRef.value) return
    if (visibilityTimer) clearTimeout(visibilityTimer)
    visibilityTimer = setTimeout(() => {
      void analyticsStore.fetchSummary({ range: range.value, force: true, background: true })
    }, 800)
  }

  onMounted(() => {
    void refreshStatusesRaw()
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

  return {
    analyticsStore,
    preset,
    startDate,
    endDate,
    dateState,
    fleetApps,
    getAppStatus,
    refreshStatusesRaw,
    indexnowSummary,
    refreshIndexnowSummary,
    indexnowSubmitting,
    submitAllIndexnow,
    gscSitemapSummary,
    refreshGscSitemapSummary,
    gscSitemapSubmitting,
    submitAllGscSitemap,
    range,
    summary,
    snapshotMap,
    summaryLoading,
    summaryError,
    insights,
    summaryRevalidating,
    serverStale,
    freshness,
    loadSummary,
    refreshAll,
    refreshFleetHealth,
    batchSubmitIndexnow,
    batchSubmitGscSitemap,
  }
}
