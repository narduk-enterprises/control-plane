import { defineStore } from 'pinia'
import type {
  AnalyticsInsight,
  AnalyticsRange,
  FleetAnalyticsDetailResponse,
  FleetAnalyticsSummaryResponse,
  FleetIntegrationHealthResponse,
} from '~/types/analytics'
import type { AnalyticsDatePreset as DatePreset, LoadStatus } from '~/types/store'

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? ''
}

function computeDates(preset: DatePreset): AnalyticsRange {
  const now = new Date()
  const endDate = formatDate(now)

  switch (preset) {
    case '1h':
      return {
        startDate: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
        endDate: now.toISOString(),
      }
    case 'today':
      return { startDate: endDate, endDate }
    case 'yesterday': {
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      const value = formatDate(yesterday)
      return { startDate: value, endDate: value }
    }
    case '7d': {
      const start = new Date(now)
      start.setDate(start.getDate() - 7)
      return { startDate: formatDate(start), endDate }
    }
    case '30d': {
      const start = new Date(now)
      start.setDate(start.getDate() - 30)
      return { startDate: formatDate(start), endDate }
    }
    case '90d': {
      const start = new Date(now)
      start.setDate(start.getDate() - 90)
      return { startDate: formatDate(start), endDate }
    }
    case 'custom':
      return { startDate: endDate, endDate }
  }
}

function rangeKey(range: AnalyticsRange) {
  return `${range.startDate}__${range.endDate}`
}

function detailKey(appName: string, range: AnalyticsRange) {
  return `${appName}__${rangeKey(range)}`
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected analytics error'
}

export const useAnalyticsStore = defineStore('analytics', () => {
  const appFetch = useAppFetch()

  const initialized = ref(false)
  const preset = ref<DatePreset>('30d')
  const initialRange = computeDates('30d')
  const startDate = ref(initialRange.startDate)
  const endDate = ref(initialRange.endDate)

  const summaries = ref<Record<string, FleetAnalyticsSummaryResponse>>({})
  const summaryStatuses = ref<Record<string, LoadStatus>>({})
  const summaryErrors = ref<Record<string, string | null>>({})

  const details = ref<Record<string, FleetAnalyticsDetailResponse>>({})
  const detailStatuses = ref<Record<string, LoadStatus>>({})
  const detailErrors = ref<Record<string, string | null>>({})

  const integrationHealth = ref<FleetIntegrationHealthResponse | null>(null)
  const integrationHealthStatus = ref<LoadStatus>('idle')
  const integrationHealthError = ref<string | null>(null)

  function currentRange(): AnalyticsRange {
    return { startDate: startDate.value, endDate: endDate.value }
  }

  function setPreset(nextPreset: DatePreset) {
    initialized.value = true
    preset.value = nextPreset
    if (nextPreset !== 'custom') {
      const nextRange = computeDates(nextPreset)
      startDate.value = nextRange.startDate
      endDate.value = nextRange.endDate
    }
  }

  function setCustomRange(range: AnalyticsRange) {
    initialized.value = true
    preset.value = 'custom'
    startDate.value = range.startDate
    endDate.value = range.endDate
  }

  async function fetchSummary(options?: { range?: AnalyticsRange; force?: boolean }) {
    const range = options?.range ?? currentRange()
    const key = rangeKey(range)

    if (!options?.force && summaries.value[key]) {
      return summaries.value[key]
    }

    summaryStatuses.value[key] = 'pending'
    summaryErrors.value[key] = null

    try {
      const data = await appFetch<FleetAnalyticsSummaryResponse>('/api/fleet/analytics/summary', {
        query: {
          startDate: range.startDate,
          endDate: range.endDate,
          ...(options?.force ? { force: 'true' } : {}),
        },
      })
      summaries.value = { ...summaries.value, [key]: data }
      summaryStatuses.value[key] = 'success'
      return data
    } catch (error) {
      summaryStatuses.value[key] = 'error'
      summaryErrors.value[key] = toErrorMessage(error)
      throw error
    }
  }

  async function fetchDetail(
    appName: string,
    options?: { range?: AnalyticsRange; force?: boolean },
  ) {
    const range = options?.range ?? currentRange()
    const key = detailKey(appName, range)

    if (!options?.force && details.value[key]) {
      return details.value[key]
    }

    detailStatuses.value[key] = 'pending'
    detailErrors.value[key] = null

    try {
      const data = await appFetch<FleetAnalyticsDetailResponse>(
        `/api/fleet/analytics/${encodeURIComponent(appName)}`,
        {
          query: {
            startDate: range.startDate,
            endDate: range.endDate,
            ...(options?.force ? { force: 'true' } : {}),
          },
        },
      )
      details.value = { ...details.value, [key]: data }
      detailStatuses.value[key] = 'success'
      return data
    } catch (error) {
      detailStatuses.value[key] = 'error'
      detailErrors.value[key] = toErrorMessage(error)
      throw error
    }
  }

  async function fetchIntegrationHealth(force = false) {
    if (!force && integrationHealth.value) return integrationHealth.value

    integrationHealthStatus.value = 'pending'
    integrationHealthError.value = null

    try {
      const data = await appFetch<FleetIntegrationHealthResponse>('/api/fleet/integrations/health')
      integrationHealth.value = data
      integrationHealthStatus.value = 'success'
      return data
    } catch (error) {
      integrationHealthStatus.value = 'error'
      integrationHealthError.value = toErrorMessage(error)
      throw error
    }
  }

  function getSummary(range?: AnalyticsRange) {
    return summaries.value[rangeKey(range ?? currentRange())] ?? null
  }

  function getSummaryStatus(range?: AnalyticsRange) {
    return summaryStatuses.value[rangeKey(range ?? currentRange())] ?? 'idle'
  }

  function getSummaryError(range?: AnalyticsRange) {
    return summaryErrors.value[rangeKey(range ?? currentRange())] ?? null
  }

  function getDetail(appName: string, range?: AnalyticsRange) {
    return details.value[detailKey(appName, range ?? currentRange())] ?? null
  }

  function getDetailStatus(appName: string, range?: AnalyticsRange) {
    return detailStatuses.value[detailKey(appName, range ?? currentRange())] ?? 'idle'
  }

  function getDetailError(appName: string, range?: AnalyticsRange) {
    return detailErrors.value[detailKey(appName, range ?? currentRange())] ?? null
  }

  function getInsights(range?: AnalyticsRange): AnalyticsInsight[] {
    return getSummary(range)?.insights ?? []
  }

  return {
    preset,
    startDate,
    endDate,
    summaries,
    summaryStatuses,
    summaryErrors,
    details,
    detailStatuses,
    detailErrors,
    integrationHealth,
    integrationHealthStatus,
    integrationHealthError,
    initialized,
    currentRange,
    setPreset,
    setCustomRange,
    fetchSummary,
    fetchDetail,
    fetchIntegrationHealth,
    getSummary,
    getSummaryStatus,
    getSummaryError,
    getDetail,
    getDetailStatus,
    getDetailError,
    getInsights,
  }
})
