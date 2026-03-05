import type { MaybeRefOrGetter } from 'vue'

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

interface GscQueryResponse {
  app: string
  rows: GscRow[]
  totals: GscTotals | null
  inspection: GscInspection | null
  startDate: string
  endDate: string
  dimension: string
}

export function useFleetGscQuery(
  appName: MaybeRefOrGetter<string>,
  params: MaybeRefOrGetter<GscQueryParams>,
) {
  const query = computed(() => {
    const p = toValue(params)
    if (!p.startDate || !p.endDate) return {}
    return {
      startDate: p.startDate,
      endDate: p.endDate,
      dimension: p.dimension,
      ...(p.force ? { force: 'true' } : {}),
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Nuxt runtime supports null, types don't
  const { data, error, pending, refresh } = useFetch<GscQueryResponse>(() => {
    const app = toValue(appName)
    if (!app) return null as any
    return `/api/fleet/gsc/${encodeURIComponent(app)}`
  }, {
    query,
    server: false,
    lazy: true,
    watch: false,
  })

  return { data, error, loading: pending, load: refresh }
}
