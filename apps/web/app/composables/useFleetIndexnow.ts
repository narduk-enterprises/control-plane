import type { MaybeRefOrGetter } from 'vue'
import { toValue, computed } from 'vue'

export function useFleetIndexnow(appName: MaybeRefOrGetter<string>) {
  const key = computed(() => `/api/fleet/indexnow/${encodeURIComponent(toValue(appName))}`)
  const { data, error, pending, refresh } = useFetch<{
    app: string
    status: number
    targetUrl: string
    response: any
    indexnowLastSubmission?: string
    indexnowTotalSubmissions?: number
    indexnowLastSubmittedCount?: number
  }>(key, {
    method: 'POST',
    body: {},
    immediate: false,
  })
  return { data, error, loading: pending, submit: refresh }
}
