import type { MaybeRefOrGetter } from 'vue'
import { toValue, computed } from 'vue'

export function useFleetPosthog(
  appName: MaybeRefOrGetter<string>,
  startDate: MaybeRefOrGetter<string>,
  endDate: MaybeRefOrGetter<string>,
  force: MaybeRefOrGetter<boolean> = false,
) {
  const key = computed(() => {
    const app = encodeURIComponent(toValue(appName))
    const sd = toValue(startDate)
    const ed = toValue(endDate)
    return `/api/fleet/posthog/${app}?startDate=${sd}&endDate=${ed}&force=${toValue(force)}`
  })
  const { data, error, status, refresh } = useFetch<{
    app: string
    summary: unknown
    timeSeries: { date: string, value: number }[]
    topPages: { name: string, count: number }[]
    topReferrers: { name: string, count: number }[]
    topCountries: { name: string, count: number }[]
    topBrowsers: { name: string, count: number }[]
    replaysUrl: string
    startDate: string
    endDate: string
  }>(key, { lazy: true, server: false })

  return {
    data,
    error,
    loading: computed(() => status.value === 'pending'),
    load: refresh
  }
}
