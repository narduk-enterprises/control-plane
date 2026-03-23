import type { MaybeRefOrGetter } from 'vue'

/**
 * Composable for GSC sitemap submission (Search Console sitemaps API).
 * Uses $fetch for one-shot POST mutation — not useFetch.
 */
export interface FleetGscSitemapResponse {
  app: string
  action: 'submitted' | 'unchanged'
  gscSiteUrl?: string
  sitemapUrl: string
  fingerprint: string
}

export function useFleetGscSitemap(appName: MaybeRefOrGetter<string>) {
  const resolvedApp = computed(() => toValue(appName))
  const data = ref<FleetGscSitemapResponse | null>(null)
  const error = ref<Error | null>(null)
  const loading = ref(false)

  async function submit(force = true) {
    const app = resolvedApp.value
    if (!app) return
    loading.value = true
    error.value = null
    try {
      const result = await $fetch<FleetGscSitemapResponse>(
        `/api/fleet/gsc-sitemap/${encodeURIComponent(app)}`,
        {
          method: 'POST',
          body: { force },
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        },
      )
      data.value = result
    } catch (err) {
      error.value = err as Error
    } finally {
      loading.value = false
    }
  }

  return { data, error, loading, submit }
}
