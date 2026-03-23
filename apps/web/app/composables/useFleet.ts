import { storeToRefs } from 'pinia'
import type { FleetRegistryApp } from '~/types/fleet'
import { useFleetRegistryStore } from '~/stores/fleetRegistry'

export type FleetApp = FleetRegistryApp

export function useFleet(options?: { includeInactive?: boolean }) {
  const registryStore = useFleetRegistryStore()
  const { activeApps, allApps, statuses, statusesStatus, statusMap, refreshingStatuses } =
    storeToRefs(registryStore)
  const mappedStatuses = computed(() => new Map(Object.entries(statusMap.value)))

  const apps = computed(() =>
    (options?.includeInactive ? allApps.value : activeApps.value).filter(Boolean),
  )
  const rawApps = computed(() => (options?.includeInactive ? allApps.value : activeApps.value))

  onMounted(() => {
    void registryStore.ensureApps(options?.includeInactive === true)
    void registryStore.ensureStatuses()
  })

  async function forceRefreshAll() {
    await Promise.all([
      registryStore.refreshApps(options?.includeInactive === true),
      registryStore.loadStatuses(true),
    ])
  }

  const isLoading = computed(() => {
    return (
      (options?.includeInactive ? registryStore.allAppsStatus : registryStore.appsStatus) ===
        'pending' || statusesStatus.value === 'pending'
    )
  })

  const admin = useFleetAdmin()

  return {
    apps,
    rawApps,
    rawStatuses: statuses,
    statusMap: mappedStatuses,

    getAppStatus: registryStore.getAppStatus,
    refreshStatuses: registryStore.refreshAllStatuses,
    refreshAppStatus: registryStore.refreshAppStatus,
    isAppRefreshing: registryStore.isAppRefreshing,
    isRefreshingStatus: refreshingStatuses,

    refreshApps: () => registryStore.ensureApps(options?.includeInactive === true),
    forceRefreshApps: () => registryStore.refreshApps(options?.includeInactive === true),
    refreshStatusesRaw: () => registryStore.loadStatuses(true),
    forceRefreshAll,
    isLoading,

    adminAddApp: admin.addApp,
    adminEditApp: admin.editApp,
    adminToggleApp: admin.toggleApp,
    adminDeleteApp: admin.deleteApp,
  }
}
