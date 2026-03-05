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

export function useFleetIndexnow(appName: MaybeRefOrGetter<string>) {
  const resolvedApp = computed(() => toValue(appName))

  const { data, error, pending, refresh } = useFetch<FleetIndexnowResponse>(
    () => `/api/fleet/indexnow/${encodeURIComponent(resolvedApp.value || '_')}`,
    {
      method: 'POST',
      body: {},
      immediate: false,
      server: false,
      watch: false,
    },
  )

  async function submit() {
    if (!resolvedApp.value) return
    await refresh()
  }

  return { data, error, loading: pending, submit }
}
