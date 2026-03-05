interface IndexnowSummary {
  totalSubmissions: number
  appsWithIndexnow: number
  totalFleetSize: number
}

export function useFleetIndexnowSummary() {
  const { data, status, refresh } = useFetch<IndexnowSummary>('/api/fleet/indexnow/summary')

  return { data, status, refresh }
}
