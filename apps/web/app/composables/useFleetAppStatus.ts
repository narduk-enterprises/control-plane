import type { FleetAppStatusRecord } from '~/types/fleet'

/**
 * Composable that fetches all fleet app statuses from the DB-backed endpoint.
 * Returns a reactive map keyed by app name for O(1) lookups, plus a refresh function
 * that triggers a manual re-check of all fleet apps.
 */
export function useFleetStatuses() {
    const { data: statuses, refresh: refetch, status: fetchStatus } = useFetch<FleetAppStatusRecord[]>('/api/fleet/status', {
        default: () => [],
        lazy: true,
        server: false,
    })

    const statusMap = computed(() => {
        const map = new Map<string, FleetAppStatusRecord>()
        for (const s of statuses.value) {
            map.set(s.app, s)
        }
        return map
    })

    const isRefreshing = ref(false)

    async function refreshStatuses() {
        isRefreshing.value = true
        try {
            await $fetch('/api/fleet/status/refresh', { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
            await refetch()
        }
        finally {
            isRefreshing.value = false
        }
    }

    const refreshingApps = ref(new Set<string>())

    async function refreshAppStatus(appName: string) {
        refreshingApps.value.add(appName)
        try {
            await $fetch(`/api/fleet/status/${appName}/refresh`, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
            await refetch()
        }
        finally {
            refreshingApps.value.delete(appName)
        }
    }

    function isAppRefreshing(appName: string): boolean {
        return refreshingApps.value.has(appName)
    }

    function getStatus(appName: string): FleetAppStatusRecord | undefined {
        return statusMap.value.get(appName)
    }

    return {
        statuses,
        statusMap,
        fetchStatus,
        isRefreshing,
        getStatus,
        refreshStatuses,
        refreshAppStatus,
        isAppRefreshing,
        refetch,
    }
}
