import type { MaybeRefOrGetter } from 'vue'
import type { FleetGAResponse } from '~/types/analytics'

export function useFleetGA(
  appName: MaybeRefOrGetter<string>,
  startDate: MaybeRefOrGetter<string>,
  endDate: MaybeRefOrGetter<string>,
  force: MaybeRefOrGetter<boolean> = false,
) {
  const resolvedApp = computed(() => toValue(appName))
  const shouldForce = computed(() => toValue(force))
  const path = computed(() => `/api/fleet/ga/${encodeURIComponent(resolvedApp.value || '_')}`)
  const query = computed(() => ({
    startDate: toValue(startDate),
    endDate: toValue(endDate),
    force: shouldForce.value ? 'true' : undefined,
  }))
  const fetchKey = computed(
    () => `fleet-ga-${resolvedApp.value}-${toValue(startDate)}-${toValue(endDate)}`,
  )

  return useFleetAnalyticsRequest<FleetGAResponse>(path, fetchKey, query)
}
