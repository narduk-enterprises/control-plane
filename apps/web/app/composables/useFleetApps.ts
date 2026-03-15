import type { FleetApp } from '~/composables/useFleet'

/**
 * Composable for the fleet apps list (read-only).
 * Fetches the app registry and provides sorted, reactive data.
 */
export function useFleetApps(options?: { includeInactive?: boolean }) {
  const forceRef = ref(false)
  const query = computed(() => ({
    ...(options?.includeInactive ? { includeInactive: 'true' } : {}),
    ...(forceRef.value ? { force: 'true' } : {}),
  }))

  const {
    data: rawApps,
    refresh,
    status,
  } = useFetch<FleetApp[]>('/api/fleet/apps', {
    query,
    default: () => [],
    server: false,
    lazy: true,
  })

  const apps = computed(() => {
    return [...(rawApps.value ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  })

  async function forceRefresh() {
    forceRef.value = true
    await refresh()
    forceRef.value = false
  }

  return {
    apps,
    rawApps,
    status,
    refresh,
    forceRefresh,
  }
}
