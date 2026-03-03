import type { MaybeRefOrGetter } from 'vue'
import { toValue, computed } from 'vue'

export function useFleetPosthog(appName: MaybeRefOrGetter<string>) {
  const key = computed(() => `/api/fleet/posthog/${encodeURIComponent(toValue(appName))}`)
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
  }>(key, { immediate: false, lazy: true, server: false })

  return {
    data,
    error,
    loading: computed(() => status.value === 'pending'),
    load: refresh
  }
}
