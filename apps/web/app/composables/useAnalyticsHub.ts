import { storeToRefs } from 'pinia'
import { useAnalyticsStore } from '~/stores/analytics'

/**
 * Orchestrates fleet analytics hub data: range, summary load, background revalidate, integration health.
 * Pages stay thin; the Pinia store holds cached summaries.
 */
export function useAnalyticsHub() {
  const analyticsStore = useAnalyticsStore()
  const { preset, startDate, endDate } = storeToRefs(analyticsStore)
  const dateState = useAnalyticsDateRange('30d')

  const { apps: fleetApps, getAppStatus, refreshStatusesRaw } = useFleet()

  const { data: indexnowSummary, refresh: refreshIndexnowSummary } = useFleetIndexnowSummary()
  const { submitting: indexnowSubmitting, submitAll: submitAllIndexnow } =
    useBatchIndexnow(fleetApps)

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
      refreshStatusesRaw(),
    ])
  }

  async function batchSubmitIndexnow() {
    await submitAllIndexnow()
    await refreshIndexnowSummary()
  }

  watch(range, () => {
    if (preset.value !== '1h') {
      void loadSummary(false, false)
    }
  })

  let visibilityTimer: ReturnType<typeof setTimeout> | undefined

  function onVisibility() {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
    if (preset.value === '1h') return
    if (visibilityTimer) clearTimeout(visibilityTimer)
    visibilityTimer = setTimeout(() => {
      void analyticsStore.fetchSummary({ range: range.value, force: true, background: true })
    }, 800)
  }

  onMounted(() => {
    void refreshStatusesRaw()
    void loadSummary(false, false)
    void analyticsStore.fetchIntegrationHealth()
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
    batchSubmitIndexnow,
  }
}
