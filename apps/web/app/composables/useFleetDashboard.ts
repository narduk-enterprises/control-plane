export interface FleetApp {
  name: string
  url: string
  dopplerProject: string
}

export function useFleetDashboard() {
  const { data: apps, refresh: refreshApps } = useFetch<FleetApp[]>('/api/fleet/apps', {
    default: () => [],
  })
  return { apps, refreshApps }
}
