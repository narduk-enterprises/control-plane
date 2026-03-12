import type { MaybeRefOrGetter } from 'vue'

export interface GscSeriesRow {
  date: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface FleetGscSeriesResponse {
  app: string
  timeSeries: GscSeriesRow[]
  compareTimeSeries?: GscSeriesRow[]
  startDate: string
  endDate: string
}

export function useFleetGscSeries(
  appName: MaybeRefOrGetter<string>,
  startDate: MaybeRefOrGetter<string>,
  endDate: MaybeRefOrGetter<string>,
  options: {
    compareStartDate?: MaybeRefOrGetter<string>
    compareEndDate?: MaybeRefOrGetter<string>
    force?: MaybeRefOrGetter<boolean>
  } = {},
) {
  const resolvedApp = computed(() => toValue(appName))

  const query = computed(() => {
    const start = toValue(startDate)
    const end = toValue(endDate)
    const q: Record<string, string> = { startDate: start, endDate: end }
    const compareStart = toValue(options.compareStartDate)
    const compareEnd = toValue(options.compareEndDate)
    if (compareStart) q.compareStartDate = compareStart
    if (compareEnd) q.compareEndDate = compareEnd
    // eslint-disable-next-line narduk/no-composable-conditional-hooks -- false positive: toValue(options.force) is not conditional
    if (toValue(options.force)) q.force = 'true'
    return q
  })

  const { data, error, status, refresh } = useFetch<FleetGscSeriesResponse>(
    () => `/api/fleet/gsc/${encodeURIComponent(resolvedApp.value || '_')}/series`,
    {
      query,
      lazy: true,
      server: false,
      watch: false,
      immediate: false,
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
