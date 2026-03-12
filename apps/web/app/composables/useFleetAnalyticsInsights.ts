import type { MaybeRefOrGetter } from 'vue'

export interface AnalyticsInsight {
  type: 'spike' | 'drop' | 'milestone'
  severity: 'info' | 'warning' | 'critical'
  appName: string
  message: string
  metric: string
  currentValue?: number
  previousValue?: number
  delta?: number
}

export function useFleetAnalyticsInsights(
  startDate: MaybeRefOrGetter<string>,
  endDate: MaybeRefOrGetter<string>,
  options?: { force?: MaybeRefOrGetter<boolean> },
) {
  const query = computed(() => ({
    startDate: toValue(startDate),
    endDate: toValue(endDate),
    // eslint-disable-next-line narduk/no-composable-conditional-hooks -- false positive: toValue(options?.force) is not conditional
    ...(toValue(options?.force) ? { force: 'true' } : {}),
  }))

  const { data, status, error, refresh } = useFetch<{ insights: AnalyticsInsight[]; startDate: string; endDate: string }>(
    '/api/fleet/analytics/insights',
    {
      query,
      lazy: true,
      server: false,
      watch: false,
    },
  )

  const insights = computed(() => data.value?.insights ?? [])
  const loading = computed(() => status.value === 'pending')

  async function load() {
    await refresh()
  }

  return { data, insights, loading, status, error, load, refresh }
}
