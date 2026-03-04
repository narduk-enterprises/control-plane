type PosthogSummaryMap = Record<string, { eventCount: number; users: number }>

export function useFleetPosthogSummary() {
    const loaded = ref(false)

    const { data, error, status, execute } = useFetch<PosthogSummaryMap>(
        '/api/fleet/posthog/summary',
        { default: () => ({}), server: false, immediate: false },
    )

    async function load() {
        await execute()
        loaded.value = true
    }

    async function refreshApp(appName: string) {
        const data = await $fetch<{ summary: { event_count: number; unique_users: number } }>(
            `/api/fleet/posthog/${encodeURIComponent(appName)}`,
            { query: { summaryOnly: 'true', force: 'true' } },
        )
        return data?.summary
            ? {
                eventCount: data.summary.event_count,
                users: data.summary.unique_users,
            }
            : null
    }

    return {
        summary: data,
        error,
        loaded: readonly(loaded),
        loading: computed(() => status.value === 'pending'),
        load,
        refreshApp,
    }
}
