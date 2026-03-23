import type { MaybeRefOrGetter } from 'vue'
import { getNuxtCachedData, markNuxtFetchedAt } from '~/utils/fetchCache'

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
  fetchedAt: string
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
  const nuxtApp = useNuxtApp()

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
      key: computed(
        () => `fleet-gsc-series-${resolvedApp.value}-${toValue(startDate)}-${toValue(endDate)}`,
      ),
      query,
      lazy: true,
      server: false,
      watch: false,
      immediate: false,
      getCachedData(key, nuxtApp) {
        return getNuxtCachedData<FleetGscSeriesResponse>(key, nuxtApp)
      },
      transform(input) {
        const key = `fleet-gsc-series-${resolvedApp.value}-${toValue(startDate)}-${toValue(endDate)}`
        markNuxtFetchedAt(nuxtApp, key)
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
