/**
 * Thin facade composable that composes useFleetApps, useFleetStatuses,
 * and useFleetAdmin. Preserves the existing public API so existing consumers
 * don't break, while the real logic lives in focused composables.
 *
 * New code should import the focused composables directly instead of this.
 */

export interface FleetApp {
  name: string
  url: string
  dopplerProject: string
  gaPropertyId?: string | null
  gaMeasurementId?: string | null
  posthogAppName?: string | null
  githubRepo?: string | null
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

type PosthogSummaryMap = Record<string, { eventCount: number; users: number }>

export function useFleet(options?: { includeInactive?: boolean }) {
  const {
    apps,
    rawApps,
    refresh: refreshApps,
    forceRefresh: forceRefreshApps,
    status: appsStatus,
  } = useFleetApps(options)
  const {
    rawStatuses,
    statusMap,
    getAppStatus,
    refreshRaw: refreshStatusesRaw,
    refreshAll: refreshStatuses,
    refreshApp: refreshAppStatus,
    isAppRefreshing,
    isRefreshing: isRefreshingStatus,
    status: statusesStatus,
  } = useFleetStatuses()
  const {
    addApp: adminAddApp,
    editApp: adminEditApp,
    toggleApp: adminToggleApp,
    deleteApp: adminDeleteApp,
  } = useFleetAdmin()

  // PostHog summary — kept here since it's only used by the dashboard facade
  const posthogForce = ref(false)
  const {
    data: rawPosthog,
    refresh: refreshPosthog,
    status: posthogStatus,
  } = useFetch<PosthogSummaryMap>('/api/fleet/posthog/summary', {
    query: computed(() => (posthogForce.value ? { force: 'true' } : {})),
    default: () => ({}),
    server: false,
    lazy: true,
  })

  async function forceRefreshAll() {
    posthogForce.value = true
    await Promise.all([forceRefreshApps(), refreshStatusesRaw(), refreshPosthog()])
    posthogForce.value = false
  }

  const isLoading = computed(() => {
    return (
      appsStatus.value === 'pending' ||
      statusesStatus.value === 'pending' ||
      posthogStatus.value === 'pending'
    )
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
    forceRefreshApps,
    refreshPosthog,
    refreshStatusesRaw,
    forceRefreshAll,
    isLoading,

    adminAddApp,
    adminEditApp,
    adminToggleApp,
    adminDeleteApp,
  }
}
