import type { MaybeRefOrGetter } from 'vue'

interface FleetIndexnowResponse {
  app: string
  status: number
  targetUrl: string
  response: unknown
  message?: string
  indexnowLastSubmission?: string
  indexnowTotalSubmissions?: number
  indexnowLastSubmittedCount?: number
}

/**
 * Composable for IndexNow submission.
 * Uses $fetch for one-shot POST mutation — not useFetch.
 */
export function useFleetIndexnow(appName: MaybeRefOrGetter<string>) {
  const resolvedApp = computed(() => toValue(appName))
  const data = ref<FleetIndexnowResponse | null>(null)
  const error = ref<Error | null>(null)
  const loading = ref(false)

  async function submit() {
    const app = resolvedApp.value
    if (!app) return
    loading.value = true
    error.value = null
    try {
      const result = await $fetch<FleetIndexnowResponse>(
        `/api/fleet/indexnow/${encodeURIComponent(app)}`,
        {
          method: 'POST',
          body: {},
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
