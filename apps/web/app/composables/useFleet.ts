import type { Ref } from 'vue'
import type { FleetAppStatusRecord } from '~/types/fleet'

export interface FleetApp {
  name: string
  url: string
  dopplerProject: string
  posthogAppName?: string
}

type PosthogSummaryMap = Record<string, { eventCount: number; users: number }>

export function useFleet(forceRefresh?: Ref<boolean>) {
  // 1. Unified Fetching
  const q = computed(() => ({ force: forceRefresh?.value ? 'true' : undefined }))

  const { data: rawApps, refresh: refreshApps, status: appsStatus } = useFetch<FleetApp[]>('/api/fleet/apps', {
    default: () => [],
    query: q,
  })

  const { data: rawStatuses, refresh: refreshStatusesRaw, status: statusesStatus } = useFetch<FleetAppStatusRecord[]>('/api/fleet/status', {
    default: () => [],
    query: q,
    lazy: true,
    server: false,
  })

  const { data: rawPosthog, refresh: refreshPosthog, status: posthogStatus } = useFetch<PosthogSummaryMap>('/api/fleet/posthog/summary', {
    default: () => ({}),
    query: q,
    server: false,
    lazy: true
  })

  // 2. Transformed & Sorted Data Maps
  const apps = computed(() => {
    return [...(rawApps.value ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  })

  const statusMap = computed(() => {
    const map = new Map<string, FleetAppStatusRecord>()
    for (const s of rawStatuses.value) map.set(s.app, s)
    return map
  })

  // 3. Status Utilities
  function getAppStatus(appName: string): FleetAppStatusRecord | undefined {
    return statusMap.value.get(appName)
  }

  const isRefreshingStatus = ref(false)
  async function refreshStatuses() {
    isRefreshingStatus.value = true
    try {
      await $fetch('/api/fleet/status/refresh', { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      await refreshStatusesRaw()
    } finally {
      isRefreshingStatus.value = false
    }
  }

  const refreshingSpecificApps = ref(new Set<string>())
  async function refreshAppStatus(appName: string) {
    refreshingSpecificApps.value.add(appName)
    try {
      await $fetch(`/api/fleet/status/${encodeURIComponent(appName)}/refresh`, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      await refreshStatusesRaw()
    } finally {
      refreshingSpecificApps.value.delete(appName)
    }
  }
  function isAppRefreshing(appName: string): boolean {
    return refreshingSpecificApps.value.has(appName)
  }

  // 4. Global Load State
  const isLoading = computed(() => {
    return appsStatus.value === 'pending' || statusesStatus.value === 'pending' || posthogStatus.value === 'pending'
  })

  return {
    apps,
    rawApps,
    rawStatuses,
    statusMap,
    posthogSummary: rawPosthog,
    
    getAppStatus,
    refreshStatuses,
    refreshAppStatus,
    isAppRefreshing,
    isRefreshingStatus,
    
    refreshApps,
    refreshPosthog,
    isLoading,
  }
}
