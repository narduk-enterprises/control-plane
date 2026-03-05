import type { MaybeRefOrGetter } from 'vue'

interface FleetGscResponse {
  app: string
  rows: unknown[]
  startDate: string
  endDate: string
  dimension: string
}

export function useFleetGsc(appName: MaybeRefOrGetter<string>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Nuxt runtime supports null, types don't
  const { data, error, pending, refresh } = useFetch<FleetGscResponse>(() => {
    const app = toValue(appName)
    if (!app) return null as any
    return `/api/fleet/gsc/${encodeURIComponent(app)}`
  }, {
    server: false,
    lazy: true,
    watch: false,
  })

  return { data, error, loading: pending, load: refresh }
}
