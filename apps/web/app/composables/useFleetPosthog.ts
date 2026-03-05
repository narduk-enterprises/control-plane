import type { MaybeRefOrGetter } from 'vue'

interface FleetPosthogResponse {
  app: string
  summary: Record<string, unknown>
  timeSeries: { date: string, value: number }[]
  topPages: { name: string, count: number }[]
  topReferrers: { name: string, count: number }[]
  topCountries: { name: string, count: number }[]
  topBrowsers: { name: string, count: number }[]
  replaysUrl: string
  startDate: string
  endDate: string
}

export function useFleetPosthog(
  appName: MaybeRefOrGetter<string>,
  startDate: MaybeRefOrGetter<string>,
  endDate: MaybeRefOrGetter<string>,
  force: MaybeRefOrGetter<boolean> = false,
) {
  const query = computed(() => {
    const sd = toValue(startDate)
    const ed = toValue(endDate)
    if (!sd || !ed) return {}
    return {
      startDate: sd,
      endDate: ed,
      force: toValue(force) ? 'true' : undefined,
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Nuxt runtime supports null, types don't
  const { data, error, status, refresh } = useFetch<FleetPosthogResponse>(() => {
    const app = toValue(appName)
    if (!app) return null as any
    return `/api/fleet/posthog/${encodeURIComponent(app)}`
  }, {
    query,
    lazy: true,
    server: false,
    watch: false,
  })

  return {
    data,
    error,
    loading: computed(() => status.value === 'pending'),
    load: refresh,
  }
}
