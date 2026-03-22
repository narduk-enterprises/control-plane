import { storeToRefs } from 'pinia'
import type { FleetRegistryApp } from '~/types/fleet'
import { useAnalyticsStore } from '~/stores/analytics'
import { useFleetRegistryStore } from '~/stores/fleetRegistry'

export type FleetApp = FleetRegistryApp

export function useFleet(options?: { includeInactive?: boolean }) {
  const registryStore = useFleetRegistryStore()
  const analyticsStore = useAnalyticsStore()
  const { activeApps, allApps, statuses, statusesStatus, statusMap, refreshingStatuses } =
    storeToRefs(registryStore)
  const mappedStatuses = computed(() => new Map(Object.entries(statusMap.value)))

  const apps = computed(() =>
    (options?.includeInactive ? allApps.value : activeApps.value).filter(Boolean),
  )
  const rawApps = computed(() => (options?.includeInactive ? allApps.value : activeApps.value))

  const posthogSummary = computed(() => {
    const summary = analyticsStore.getSummary({
      startDate: analyticsStore.startDate,
      endDate: analyticsStore.endDate,
    })

    if (!summary) return {}

    return Object.fromEntries(
      Object.values(summary.apps).map((snapshot) => [
        snapshot.app.name,
        {
          eventCount: Number(snapshot.posthog.metrics?.summary?.event_count ?? 0),
          users: Number(snapshot.posthog.metrics?.summary?.unique_users ?? 0),
        },
      ]),
    )
  })

  onMounted(() => {
    void registryStore.ensureApps(options?.includeInactive === true)
    void registryStore.ensureStatuses()
  })

  async function refreshPosthog() {
    return analyticsStore.fetchSummary({ force: true })
  }

  async function forceRefreshAll() {
    await Promise.all([
      registryStore.refreshApps(options?.includeInactive === true),
      registryStore.loadStatuses(true),
      analyticsStore.fetchSummary({ force: true }),
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
    posthogSummary,

    getAppStatus: registryStore.getAppStatus,
    refreshStatuses: registryStore.refreshAllStatuses,
    refreshAppStatus: registryStore.refreshAppStatus,
    isAppRefreshing: registryStore.isAppRefreshing,
    isRefreshingStatus: refreshingStatuses,

    refreshApps: () => registryStore.ensureApps(options?.includeInactive === true),
    forceRefreshApps: () => registryStore.refreshApps(options?.includeInactive === true),
    refreshPosthog,
    refreshStatusesRaw: () => registryStore.loadStatuses(true),
    forceRefreshAll,
    isLoading,

    adminAddApp: admin.addApp,
    adminEditApp: admin.editApp,
    adminToggleApp: admin.toggleApp,
    adminDeleteApp: admin.deleteApp,
  }
}
