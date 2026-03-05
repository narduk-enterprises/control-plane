/* eslint-disable vue-official/no-composable-conditional-hooks -- composable function, not conditional */
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
  const resolvedApp = computed(() => toValue(appName))

  const query = computed(() => ({
    startDate: toValue(startDate),
    endDate: toValue(endDate),
    force: toValue(force) ? 'true' : undefined,
  }))

  const { data, error, status, refresh } = useFetch<FleetPosthogResponse>(
    () => `/api/fleet/posthog/${encodeURIComponent(resolvedApp.value || '_')}`,
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
