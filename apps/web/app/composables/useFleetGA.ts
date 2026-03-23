import type { MaybeRefOrGetter } from 'vue'
import type { FleetGAResponse } from '~/types/analytics'
import { getNuxtCachedData, markNuxtFetchedAt } from '~/utils/fetchCache'

/* eslint-disable narduk/no-composable-conditional-hooks -- composable function, not conditional */
export function useFleetGA(
  appName: MaybeRefOrGetter<string>,
  startDate: MaybeRefOrGetter<string>,
  endDate: MaybeRefOrGetter<string>,
  force: MaybeRefOrGetter<boolean> = false,
) {
  const resolvedApp = computed(() => toValue(appName))
  const nuxtApp = useNuxtApp()

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
      key: fetchKey,
      query,
      lazy: true,
      server: false,
      watch: false,
      immediate: false,
      getCachedData(key, nuxtApp) {
        return getNuxtCachedData<FleetGAResponse>(key, nuxtApp)
      },
      transform(input) {
        markNuxtFetchedAt(nuxtApp, fetchKey.value)
        return input
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
