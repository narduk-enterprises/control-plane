import type { MaybeRefOrGetter } from 'vue'
import { toValue, computed } from 'vue'

export function useFleetPosthog(appName: MaybeRefOrGetter<string>) {
  const key = computed(() => `/api/fleet/posthog/${encodeURIComponent(toValue(appName))}`)
  const { data, error, pending, refresh } = useFetch<{
    app: string
    summary: unknown
    startDate: string
    endDate: string
  }>(key, { immediate: false })
  return { data, error, loading: pending, load: refresh }
}
