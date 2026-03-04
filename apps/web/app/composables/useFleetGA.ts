import type { MaybeRefOrGetter } from 'vue'

export function useFleetGA(
    appName: MaybeRefOrGetter<string>,
    startDate: MaybeRefOrGetter<string>,
    endDate: MaybeRefOrGetter<string>,
    force: MaybeRefOrGetter<boolean> = false,
) {
    const key = computed(() => {
        const app = encodeURIComponent(toValue(appName))
        const sd = toValue(startDate)
        const ed = toValue(endDate)
        return `/api/fleet/ga/${app}?startDate=${sd}&endDate=${ed}&force=${toValue(force)}`
    })
    const { data, error, status, refresh } = useFetch<{
        app: string
        propertyId: string
        summary: Record<string, unknown>
        deltas: Record<string, number> | null
        timeSeries: { date: string, value: number }[]
        startDate: string
        endDate: string
    }>(key, {
        lazy: true,
        server: false,
    })

    return {
        data,
        error,
        loading: computed(() => status.value === 'pending'),
        load: refresh,
    }
}
