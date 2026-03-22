import { defineStore } from 'pinia'
import type { FleetRegistryApp, FleetAppStatusRecord } from '~/types/fleet'
import type { LoadStatus } from '~/types/store'

export const useFleetRegistryStore = defineStore('fleet-registry', () => {
  const appFetch = useAppFetch()

  const activeApps = ref<FleetRegistryApp[]>([])
  const allApps = ref<FleetRegistryApp[]>([])
  const appsStatus = ref<LoadStatus>('idle')
  const allAppsStatus = ref<LoadStatus>('idle')

  const statuses = ref<FleetAppStatusRecord[]>([])
  const statusesStatus = ref<LoadStatus>('idle')
  const refreshingStatuses = ref(false)
  const refreshingApps = ref<string[]>([])

  async function loadApps(options?: { includeInactive?: boolean; force?: boolean }) {
    const includeInactive = options?.includeInactive === true
    const statusRef = includeInactive ? allAppsStatus : appsStatus
    statusRef.value = 'pending'

    try {
      const data = await appFetch<FleetRegistryApp[]>('/api/fleet/apps', {
        query: {
          ...(includeInactive ? { includeInactive: 'true' } : {}),
          ...(options?.force ? { force: 'true' } : {}),
        },
      })

      const sorted = [...data].sort((left, right) => left.name.localeCompare(right.name))
      if (includeInactive) {
        allApps.value = sorted
      } else {
        activeApps.value = sorted
      }
      statusRef.value = 'success'
      return sorted
    } catch (error) {
      statusRef.value = 'error'
      throw error
    }
  }

  async function ensureApps(includeInactive = false) {
    const cache = includeInactive ? allApps.value : activeApps.value
    if (cache.length > 0) return cache
    return loadApps({ includeInactive })
  }

  async function refreshApps(includeInactive = false) {
    return loadApps({ includeInactive, force: true })
  }

  async function loadStatuses(force = false) {
    statusesStatus.value = 'pending'

    try {
      const data = await appFetch<FleetAppStatusRecord[]>('/api/fleet/status', {
        query: force ? { force: 'true' } : undefined,
      })
      statuses.value = data
      statusesStatus.value = 'success'
      return data
    } catch (error) {
      statusesStatus.value = 'error'
      throw error
    }
  }

  async function ensureStatuses() {
    if (statuses.value.length > 0) return statuses.value
    return loadStatuses()
  }

  async function refreshAllStatuses() {
    refreshingStatuses.value = true
    try {
      await appFetch('/api/fleet/status/refresh', {
        method: 'POST',
      })
      await loadStatuses(true)
    } finally {
      refreshingStatuses.value = false
    }
  }

  async function refreshAppStatus(appName: string) {
    if (!refreshingApps.value.includes(appName)) {
      refreshingApps.value = [...refreshingApps.value, appName]
    }
    try {
      await appFetch(`/api/fleet/status/${encodeURIComponent(appName)}/refresh`, {
        method: 'POST',
      })
      await loadStatuses(true)
    } finally {
      refreshingApps.value = refreshingApps.value.filter((item) => item !== appName)
    }
  }

  const statusMap = computed<Record<string, FleetAppStatusRecord>>(() => {
    const map: Record<string, FleetAppStatusRecord> = {}
    for (const item of statuses.value) {
      map[item.app] = item
    }
    return map
  })

  function getAppStatus(appName: string) {
    return statusMap.value[appName]
  }

  function isAppRefreshing(appName: string) {
    return refreshingApps.value.includes(appName)
  }

  return {
    activeApps,
    allApps,
    appsStatus,
    allAppsStatus,
    statuses,
    statusesStatus,
    refreshingStatuses,
    refreshingApps,
    statusMap,
    ensureApps,
    refreshApps,
    ensureStatuses,
    loadStatuses,
    refreshAllStatuses,
    refreshAppStatus,
    getAppStatus,
    isAppRefreshing,
  }
})
