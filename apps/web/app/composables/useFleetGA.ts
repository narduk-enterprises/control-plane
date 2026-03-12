/* eslint-disable narduk/no-composable-conditional-hooks -- composable function, not conditional */
import type { MaybeRefOrGetter } from 'vue'

interface FleetGAResponse {
  app: string
  propertyId: string
  summary: Record<string, unknown> | null
  deltas: Record<string, number> | null
  timeSeries: { date: string, value: number }[]
  startDate: string
  endDate: string
}

export function useFleetGA(
    appName: MaybeRefOrGetter<string>,
    startDate: MaybeRefOrGetter<string>,
    endDate: MaybeRefOrGetter<string>,
    force: MaybeRefOrGetter<boolean> = false,
) {
    const resolvedApp = computed(() => toValue(appName))

    const query = computed(() => ({
      startDate: toValue(startDate),
      endDate: toValue(endDate),
      force: toValue(force) ? 'true' : undefined,
    }))

    const { data, error, status, refresh } = useFetch<FleetGAResponse>(
      () => `/api/fleet/ga/${encodeURIComponent(resolvedApp.value || '_')}`,
      {
        query,
        lazy: true,
        server: false,
        watch: false,
        immediate: false,
      },
    )

    async function load() {
      if (!resolvedApp.value) return
      await refresh()
    }

    return {
        data,
        error,
        loading: computed(() => status.value === 'pending'),
        load,
    }
}
