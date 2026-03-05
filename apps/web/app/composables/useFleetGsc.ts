import type { MaybeRefOrGetter } from 'vue'

interface FleetGscResponse {
  app: string
  rows: unknown[]
  startDate: string
  endDate: string
  dimension: string
}

export function useFleetGsc(appName: MaybeRefOrGetter<string>) {
  const resolvedApp = computed(() => toValue(appName))

  const { data, error, pending, refresh } = useFetch<FleetGscResponse>(
    () => `/api/fleet/gsc/${encodeURIComponent(resolvedApp.value || '_')}`,
    {
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
