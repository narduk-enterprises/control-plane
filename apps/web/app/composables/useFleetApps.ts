import { storeToRefs } from 'pinia'
import type { FleetRegistryApp } from '~/types/fleet'
import { useFleetRegistryStore } from '~/stores/fleetRegistry'

export function useFleetApps(options?: { includeInactive?: boolean }) {
  const store = useFleetRegistryStore()
  const { activeApps, allApps, appsStatus, allAppsStatus } = storeToRefs(store)

  const rawApps = computed<FleetRegistryApp[]>(() =>
    options?.includeInactive ? allApps.value : activeApps.value,
  )
  const apps = computed(() =>
    [...rawApps.value].sort((left, right) => left.name.localeCompare(right.name)),
  )
  const status = computed(() => (options?.includeInactive ? allAppsStatus.value : appsStatus.value))

  onMounted(() => {
    void store.ensureApps(options?.includeInactive === true)
  })

  async function refresh() {
    return store.ensureApps(options?.includeInactive === true)
  }

  async function forceRefresh() {
    return store.refreshApps(options?.includeInactive === true)
  }

  return {
    apps,
    rawApps,
    status,
    refresh,
    forceRefresh,
  }
}
