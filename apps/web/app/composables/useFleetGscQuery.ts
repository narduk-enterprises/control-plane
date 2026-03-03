import type { MaybeRefOrGetter } from 'vue'
import { toValue, computed } from 'vue'

export type GscDimension = 'query' | 'page' | 'device' | 'country' | 'searchAppearance'

export interface GscRow {
  keys?: string[]
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
}

export interface GscQueryParams {
  startDate: string
  endDate: string
  dimension: GscDimension
}

export function useFleetGscQuery(
  appName: MaybeRefOrGetter<string>,
  params: MaybeRefOrGetter<GscQueryParams>,
) {
  const key = computed(() => {
    const app = encodeURIComponent(toValue(appName))
    const p = toValue(params)
    const q = new URLSearchParams({
      startDate: p.startDate,
      endDate: p.endDate,
      dimension: p.dimension,
    }).toString()
    return `/api/fleet/gsc/${app}?${q}`
  })
  const { data, error, pending, refresh } = useFetch<{
    app: string
    rows: GscRow[]
    startDate: string
    endDate: string
    dimension: string
  }>(key, { immediate: false })
  return { data, error, loading: pending, load: refresh }
}
