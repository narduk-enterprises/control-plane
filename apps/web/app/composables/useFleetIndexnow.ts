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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Nuxt runtime supports null, types don't
  const { data, error, pending, refresh } = useFetch<FleetIndexnowResponse>(() => {
    const app = toValue(appName)
    if (!app) return null as any
    return `/api/fleet/indexnow/${encodeURIComponent(app)}`
  }, {
    method: 'POST',
    body: {},
    immediate: false,
    server: false,
    watch: false,
  })

  return { data, error, loading: pending, submit: refresh }
}
