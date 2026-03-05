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

  const { data, error, pending, refresh } = useFetch<GscQueryResponse>(
    () => `/api/fleet/gsc/${encodeURIComponent(resolvedApp.value || '_')}`,
    {
      query,
      server: false,
      lazy: true,
      watch: false,
      immediate: false,
    },
  )

  async function load() {
    if (!resolvedApp.value) return
    await refresh()
  }

  return { data, error, loading: pending, load }
}
