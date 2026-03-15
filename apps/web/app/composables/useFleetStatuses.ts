import type { FleetAppStatusRecord } from '~/types/fleet'

/**
 * Composable for fleet app health-status tracking.
 * Fetches status records and provides refresh utilities.
 */
export function useFleetStatuses() {
  const {
    data: rawStatuses,
    refresh: refreshRaw,
    status,
  } = useFetch<FleetAppStatusRecord[]>('/api/fleet/status', {
    default: () => [],
    lazy: true,
    server: false,
  })

  const statusMap = computed(() => {
    const map = new Map<string, FleetAppStatusRecord>()
    for (const s of rawStatuses.value) map.set(s.app, s)
    return map
  })

  function getAppStatus(appName: string): FleetAppStatusRecord | undefined {
    return statusMap.value.get(appName)
  }

  // Bulk refresh all statuses
  const isRefreshing = ref(false)
  async function refreshAll() {
    isRefreshing.value = true
    try {
      await $fetch('/api/fleet/status/refresh', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      await refreshRaw()
    } finally {
      isRefreshing.value = false
    }
  }

  // Single-app refresh
  const refreshingApps = ref(new Set<string>())
  async function refreshApp(appName: string) {
    refreshingApps.value.add(appName)
    try {
      await $fetch(`/api/fleet/status/${encodeURIComponent(appName)}/refresh`, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      await refreshRaw()
    } finally {
      refreshingApps.value.delete(appName)
    }
  }

  function isAppRefreshing(appName: string): boolean {
    return refreshingApps.value.has(appName)
  }

  return {
    rawStatuses,
    statusMap,
    status,
    getAppStatus,
    refreshRaw,
    refreshAll,
    refreshApp,
    isAppRefreshing,
    isRefreshing,
  }
}
