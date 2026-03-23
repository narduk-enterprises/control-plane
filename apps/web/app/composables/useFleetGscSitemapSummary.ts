interface GscSitemapSummary {
  totalSubmissions: number
  appsWithSubmission: number
  totalFleetSize: number
}

export function useFleetGscSitemapSummary() {
  const { data, status, refresh } = useFetch<GscSitemapSummary>('/api/fleet/gsc-sitemap/summary')

  return { data, status, refresh }
}
