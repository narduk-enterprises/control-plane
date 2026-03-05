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

export interface GscTotals {
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
}

export interface GscInspection {
  inspectionResultLink?: string
  indexStatusResult?: {
    verdict?: string
    coverageState?: string
    crawledAs?: string
    lastCrawlTime?: string
  }
}

export interface GscQueryParams {
  startDate: string
  endDate: string
  dimension: GscDimension
  force?: boolean
}

export function useFleetGscQuery(
  appName: MaybeRefOrGetter<string>,
  params: MaybeRefOrGetter<GscQueryParams>,
) {
  const key = computed(() => {
    const app = toValue(appName)
    if (!app) return null as unknown as string

    const appEncoded = encodeURIComponent(app)
    const p = toValue(params)
    if (!p.startDate || !p.endDate) return null as unknown as string

    const q = new URLSearchParams({
      startDate: p.startDate,
      endDate: p.endDate,
      dimension: p.dimension,
      ...(p.force ? { force: 'true' } : {}),
    }).toString()
    return `/api/fleet/gsc/${appEncoded}?${q}`
  })
  const { data, error, pending, refresh } = useFetch<{
    app: string
    rows: GscRow[]
    totals: GscTotals | null
    inspection: GscInspection | null
    startDate: string
    endDate: string
    dimension: string
  }>(key)
  return { data, error, loading: pending, load: refresh }
}
