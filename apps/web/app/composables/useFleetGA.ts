import type { MaybeRefOrGetter } from 'vue'

interface FleetGAResponse {
  app: string
  propertyId: string
  summary: Record<string, unknown> | null
  deltas: Record<string, number> | null
  timeSeries: { date: string, value: number }[]
  startDate: string
  endDate: string
}

export function useFleetGA(
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
    const { data, error, status, refresh } = useFetch<FleetGAResponse>(() => {
        const app = toValue(appName)
        if (!app) return null as any
        return `/api/fleet/ga/${encodeURIComponent(app)}`
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
