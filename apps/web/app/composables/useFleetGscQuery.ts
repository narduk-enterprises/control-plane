import type { MaybeRefOrGetter } from 'vue'
import type { GscQueryParams, FleetGscResponse } from '~/types/analytics'

// Re-export types for consumers
export type {
  GscDimension,
  GscRow,
  GscTotals,
  GscInspection,
  GscQueryParams,
} from '~/types/analytics'

const CACHE_MAX_AGE = 5 * 60 * 1000 // 5 minutes stale-while-revalidate

export function useFleetGscQuery(
  appName: MaybeRefOrGetter<string>,
  params: MaybeRefOrGetter<GscQueryParams>,
) {
  const resolvedApp = computed(() => toValue(appName))

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
      key: fetchKey.value,
      query,
      server: false,
      lazy: true,
      watch: false,
      immediate: false,
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

  return { data, error, loading: pending, load }
}
