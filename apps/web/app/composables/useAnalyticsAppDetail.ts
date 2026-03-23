import { storeToRefs } from 'pinia'
import { useAnalyticsStore } from '~/stores/analytics'

export interface UseAnalyticsAppDetailOptions {
  enabled?: MaybeRefOrGetter<boolean>
}

export function useAnalyticsAppDetail(
  appName: MaybeRefOrGetter<string>,
  options: UseAnalyticsAppDetailOptions = {},
) {
  const analyticsStore = useAnalyticsStore()
  const { preset, startDate, endDate } = storeToRefs(analyticsStore)
  const dateState = useAnalyticsDateRange('30d')

  const name = computed(() => toValue(appName))
  const enabled = computed(() => toValue(options.enabled ?? true))

  const range = computed(() => ({ startDate: startDate.value, endDate: endDate.value }))

  const snapshot = computed(() =>
    name.value ? analyticsStore.getDetail(name.value, range.value) : null,
  )
  const detailLoading = computed(
    () => !!name.value && analyticsStore.getDetailStatus(name.value, range.value) === 'pending',
  )
  const detailError = computed(() =>
    name.value ? analyticsStore.getDetailError(name.value, range.value) : null,
  )
  const detailRevalidating = computed(
    () => !!name.value && analyticsStore.isDetailRevalidating(name.value, range.value),
  )

  async function loadDetail(force = false, background = false) {
    if (!enabled.value || !name.value || preset.value === '1h') return
    await analyticsStore.fetchDetail(name.value, { range: range.value, force, background })
  }

  watch([name, range, enabled], () => {
    if (!enabled.value) return
    void loadDetail(false, false)
  })

  let visibilityTimer: ReturnType<typeof setTimeout> | undefined

  function onVisibility() {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
    if (!enabled.value || !name.value || preset.value === '1h') return
    if (visibilityTimer) clearTimeout(visibilityTimer)
    visibilityTimer = setTimeout(() => {
      void analyticsStore.fetchDetail(name.value, {
        range: range.value,
        force: true,
        background: true,
      })
    }, 800)
  }

  onMounted(() => {
    if (enabled.value) {
      void loadDetail(false, false)
    }
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

  async function refreshDetail() {
    await loadDetail(true, true)
  }

  return {
    analyticsStore,
    preset,
    startDate,
    endDate,
    dateState,
    range,
    snapshot,
    detailLoading,
    detailError,
    detailRevalidating,
    loadDetail,
    refreshDetail,
  }
}
