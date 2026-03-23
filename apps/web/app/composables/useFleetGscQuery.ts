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

export function useFleetGscQuery(
  appName: MaybeRefOrGetter<string>,
  params: MaybeRefOrGetter<GscQueryParams>,
) {
  const resolvedApp = computed(() => toValue(appName))
  const path = computed(() => `/api/fleet/gsc/${encodeURIComponent(resolvedApp.value || '_')}`)

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

  return useFleetAnalyticsRequest<FleetGscResponse>(path, fetchKey, query)
}
