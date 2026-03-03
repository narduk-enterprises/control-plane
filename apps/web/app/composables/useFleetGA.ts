export function useFleetGA(appName: MaybeRefOrGetter<string>) {
    const key = computed(() => `/api/fleet/ga/${encodeURIComponent(toValue(appName))}`)
    const { data, error, status, refresh } = useFetch<{
        app: string
        summary: Record<string, unknown>
        timeSeries: { date: string, value: number }[]
        startDate: string
        endDate: string
    }>(key, {
        lazy: true,
        server: false,
        immediate: false,
    })

    return {
        data,
        error,
        loading: computed(() => status.value === 'pending'),
        load: refresh,
    }
}
