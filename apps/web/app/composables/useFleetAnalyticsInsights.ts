import type { MaybeRefOrGetter } from 'vue'
import type { AnalyticsInsight } from '~/types/analytics'

// Re-export for consumers
export type { AnalyticsInsight } from '~/types/analytics'

const CLIENT_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Module-scope cache for tracking when each key was last fetched
const fetchTimestamps = new Map<string, number>()

export function useFleetAnalyticsInsights(
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

  const fetchKey = computed(
    () => `fleet-analytics-insights-${toValue(startDate)}-${toValue(endDate)}`,
  )

  const { data, status, error, refresh } = useFetch<{
    insights: AnalyticsInsight[]
    startDate: string
    endDate: string
  }>('/api/fleet/analytics/insights', {
    query,
    key: fetchKey.value,
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

  const insights = computed(() => data.value?.insights ?? [])
  const loading = computed(() => status.value === 'pending')

  async function load() {
    await refresh()
    fetchTimestamps.set(fetchKey.value, Date.now())
  }

  return { data, insights, loading, status, error, load, refresh }
}
