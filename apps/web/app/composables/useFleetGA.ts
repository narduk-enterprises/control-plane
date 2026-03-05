import type { MaybeRefOrGetter } from 'vue'

export function useFleetGA(
    appName: MaybeRefOrGetter<string>,
    startDate: MaybeRefOrGetter<string>,
    endDate: MaybeRefOrGetter<string>,
    force: MaybeRefOrGetter<boolean> = false,
) {
    const key = computed(() => {
        const app = toValue(appName)
        if (!app) return null as unknown as string
        
        const appEncoded = encodeURIComponent(app)
        const sd = toValue(startDate)
        const ed = toValue(endDate)
        if (!sd || !ed) return null as unknown as string
        
        return `/api/fleet/ga/${appEncoded}?startDate=${sd}&endDate=${ed}&force=${toValue(force)}`
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
