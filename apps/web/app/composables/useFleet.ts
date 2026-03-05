import type { FleetAppStatusRecord } from '~/types/fleet'

export interface FleetApp {
  name: string
  url: string
  dopplerProject: string
  gaPropertyId?: string | null
  posthogAppName?: string | null
  githubRepo?: string | null
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

type PosthogSummaryMap = Record<string, { eventCount: number; users: number }>

export function useFleet() {
  const { data: rawApps, refresh: refreshApps, status: appsStatus } = useFetch<FleetApp[]>('/api/fleet/apps', {
    default: () => [],
  })

  const { data: rawStatuses, refresh: refreshStatusesRaw, status: statusesStatus } = useFetch<FleetAppStatusRecord[]>('/api/fleet/status', {
    default: () => [],
    lazy: true,
    server: false,
  })

  const { data: rawPosthog, refresh: refreshPosthog, status: posthogStatus } = useFetch<PosthogSummaryMap>('/api/fleet/posthog/summary', {
    default: () => ({}),
    server: false,
    lazy: true,
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

  // 4. Force refresh all data (busts D1 caches)
  async function forceRefreshAll() {
    await Promise.all([
      refreshApps(),
      refreshStatusesRaw(),
      refreshPosthog(),
    ])
  }

  // 5. Global Load State
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
    forceRefreshAll,
    isLoading,
  }
}
