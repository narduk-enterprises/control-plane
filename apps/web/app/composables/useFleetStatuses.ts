import { storeToRefs } from 'pinia'
import { useFleetRegistryStore } from '~/stores/fleetRegistry'

export function useFleetStatuses() {
  const store = useFleetRegistryStore()
  const { refreshingStatuses, statuses, statusesStatus, statusMap } = storeToRefs(store)

  const map = computed(() => new Map(Object.entries(statusMap.value)))

  onMounted(() => {
    void store.ensureStatuses()
  })

  return {
    rawStatuses: statuses,
    statusMap: map,
    status: statusesStatus,
    getAppStatus: store.getAppStatus,
    refreshRaw: () => store.loadStatuses(true),
    refreshAll: store.refreshAllStatuses,
    refreshApp: store.refreshAppStatus,
    isAppRefreshing: store.isAppRefreshing,
    isRefreshing: refreshingStatuses,
  }
}
