import type { MaybeRefOrGetter } from 'vue'
import type { FleetGAResponse } from '~/types/analytics'

const CACHE_MAX_AGE = 5 * 60 * 1000 // 5 minutes stale-while-revalidate

/* eslint-disable narduk/no-composable-conditional-hooks -- composable function, not conditional */
export function useFleetGA(
  appName: MaybeRefOrGetter<string>,
  startDate: MaybeRefOrGetter<string>,
  endDate: MaybeRefOrGetter<string>,
  force: MaybeRefOrGetter<boolean> = false,
) {
  const resolvedApp = computed(() => toValue(appName))

  const query = computed(() => ({
    startDate: toValue(startDate),
    endDate: toValue(endDate),
    force: toValue(force) ? 'true' : undefined,
  }))

  // Unique key per app + date range for client-side dedup/caching
  const fetchKey = computed(
    () => `fleet-ga-${resolvedApp.value}-${toValue(startDate)}-${toValue(endDate)}`,
  )

  const { data, error, status, refresh } = useFetch<FleetGAResponse>(
    () => `/api/fleet/ga/${encodeURIComponent(resolvedApp.value || '_')}`,
    {
      key: fetchKey.value,
      query,
      lazy: true,
      server: false,
      watch: false,
      immediate: false,
      // Stale-while-revalidate: serve cached data, refresh in background
      getCachedData(key, nuxtApp) {
        const cached = nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
        if (!cached) return
        const timestamps = nuxtApp.payload._fetchedAt as Record<string, number> | undefined
        const fetchedAt = timestamps?.[key]
        if (fetchedAt && Date.now() - fetchedAt < CACHE_MAX_AGE) return cached
        return
      },
    },
  )

  async function load() {
    if (!resolvedApp.value) return
    await refresh()
  }

  return {
    data,
    error,
    loading: computed(() => status.value === 'pending'),
    load,
  }
}
