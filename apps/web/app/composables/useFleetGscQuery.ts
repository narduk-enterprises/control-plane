import type { MaybeRefOrGetter } from 'vue'
import type { GscQueryParams, FleetGscResponse } from '~/types/analytics'
import { getNuxtCachedData, markNuxtFetchedAt } from '~/utils/fetchCache'

// Re-export types for consumers
export type {
  GscDimension,
  GscRow,
  GscTotals,
  GscInspection,
  GscQueryParams,
} from '~/types/analytics'

export function useFleetGscQuery(
  appName: MaybeRefOrGetter<string>,
  params: MaybeRefOrGetter<GscQueryParams>,
) {
  const resolvedApp = computed(() => toValue(appName))
  const nuxtApp = useNuxtApp()

  const query = computed(() => {
    const p = toValue(params)
    return {
      startDate: p.startDate,
      endDate: p.endDate,
      dimension: p.dimension,
      ...(p.force ? { force: 'true' } : {}),
    }
  })

  const fetchKey = computed(() => {
    const p = toValue(params)
    return `fleet-gsc-${resolvedApp.value}-${p.dimension}-${p.startDate}-${p.endDate}`
  })

  const { data, error, pending, refresh } = useFetch<FleetGscResponse>(
    () => `/api/fleet/gsc/${encodeURIComponent(resolvedApp.value || '_')}`,
    {
      key: fetchKey,
      query,
      server: false,
      lazy: true,
      watch: false,
      immediate: false,
      getCachedData(key, nuxtApp) {
        return getNuxtCachedData<FleetGscResponse>(key, nuxtApp)
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

  return { data, error, loading: pending, load }
}
