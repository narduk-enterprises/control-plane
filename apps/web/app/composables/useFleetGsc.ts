import type { MaybeRefOrGetter } from 'vue'
import { toValue, computed } from 'vue'

export function useFleetGsc(appName: MaybeRefOrGetter<string>) {
  const key = computed(() => `/api/fleet/gsc/${encodeURIComponent(toValue(appName))}`)
  const { data, error, pending, refresh } = useFetch<{
    app: string
    rows: unknown[]
    startDate: string
    endDate: string
    dimension: string
  }>(key, { immediate: false })
  return { data, error, loading: pending, load: refresh }
}
