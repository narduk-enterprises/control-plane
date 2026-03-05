import type { MaybeRefOrGetter } from 'vue'

export interface SitemapAnalysisEntry {
  url: string
  status: number
  durationMs: number
  error?: string
}

export interface SitemapAnalysisResponse {
  baseUrl: string
  sitemapUrl: string
  totalUrls: number
  urls: string[]
  entries: SitemapAnalysisEntry[] | null
  deepSummary?: {
    checked: number
    ok: number
    error: number
    timeout: number
    avgDurationMs: number
  }
}

export function useFleetSitemapAnalysis(appName: MaybeRefOrGetter<string>) {
  const resolvedApp = computed(() => toValue(appName))
  const deep = ref(false)

  const url = computed(() => {
    if (!resolvedApp.value) return ''
    return `/api/fleet/sitemap-analysis/${encodeURIComponent(resolvedApp.value)}?deep=${deep.value}`
  })

  const { data, error, pending, refresh } = useFetch<SitemapAnalysisResponse>(url, {
    immediate: false,
    server: false,
    watch: false,
  })

  async function run(deepAnalysis = false) {
    if (!resolvedApp.value) return
    deep.value = !!deepAnalysis
    await refresh()
  }

  return { data, error, loading: pending, run }
}
