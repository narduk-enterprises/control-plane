import { defineStore } from 'pinia'
import type {
  AnalyticsInsight,
  AnalyticsProviderSnapshot,
  AnalyticsRange,
  FleetAnalyticsDetailResponse,
  FleetAnalyticsSummaryResponse,
  FleetIntegrationHealthResponse,
} from '~/types/analytics'
import type { AnalyticsDatePreset as DatePreset, LoadStatus } from '~/types/store'

const AUTO_REFRESH_DELAY_MS = 2_500
const MAX_AUTO_REFRESH_ATTEMPTS = 3

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

function providerIsStale(provider: AnalyticsProviderSnapshot<unknown>) {
  return provider.status === 'stale' || provider.stale
}

export function detailNeedsFollowUpRefresh(detail: FleetAnalyticsDetailResponse) {
  return [
    detail.ga,
    detail.gsc,
    detail.posthog,
    detail.indexnow,
  ].some((provider) => providerIsStale(provider))
}

export function summaryNeedsFollowUpRefresh(summary: FleetAnalyticsSummaryResponse) {
  return Object.values(summary.apps).some((snapshot) => detailNeedsFollowUpRefresh(snapshot))
}

export const useAnalyticsStore = defineStore('analytics', () => {
  const appFetch = useAppFetch()
  const summaryRefreshTimers: Record<string, number | undefined> = {}
  const summaryRefreshAttempts: Record<string, number> = {}
  const detailRefreshTimers: Record<string, number | undefined> = {}
  const detailRefreshAttempts: Record<string, number> = {}

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

  function clearSummaryFollowUp(key: string) {
    const timer = summaryRefreshTimers[key]
    if (timer && import.meta.client) {
      clearTimeout(timer)
    }
    summaryRefreshTimers[key] = undefined
    summaryRefreshAttempts[key] = 0
  }

  function clearDetailFollowUp(key: string) {
    const timer = detailRefreshTimers[key]
    if (timer && import.meta.client) {
      clearTimeout(timer)
    }
    detailRefreshTimers[key] = undefined
    detailRefreshAttempts[key] = 0
  }

  function scheduleSummaryFollowUp(range: AnalyticsRange) {
    if (!import.meta.client) return

    const key = rangeKey(range)
    if (summaryRefreshTimers[key]) return
    if ((summaryRefreshAttempts[key] ?? 0) >= MAX_AUTO_REFRESH_ATTEMPTS) return

    summaryRefreshAttempts[key] = (summaryRefreshAttempts[key] ?? 0) + 1
    summaryRefreshTimers[key] = window.setTimeout(async () => {
      summaryRefreshTimers[key] = undefined
      try {
        await fetchSummary({ range, force: true, background: true })
      } catch {
        // Keep the last rendered snapshot; the error alert path already covers hard failures.
      }
    }, AUTO_REFRESH_DELAY_MS)
  }

  function scheduleDetailFollowUp(appName: string, range: AnalyticsRange) {
    if (!import.meta.client) return

    const key = detailKey(appName, range)
    if (detailRefreshTimers[key]) return
    if ((detailRefreshAttempts[key] ?? 0) >= MAX_AUTO_REFRESH_ATTEMPTS) return

    detailRefreshAttempts[key] = (detailRefreshAttempts[key] ?? 0) + 1
    detailRefreshTimers[key] = window.setTimeout(async () => {
      detailRefreshTimers[key] = undefined
      try {
        await fetchDetail(appName, { range, force: true, background: true })
      } catch {
        // Keep the last rendered snapshot; the error alert path already covers hard failures.
      }
    }, AUTO_REFRESH_DELAY_MS)
  }

  async function fetchSummary(options?: {
    range?: AnalyticsRange
    force?: boolean
    background?: boolean
  }) {
    const range = options?.range ?? currentRange()
    const key = rangeKey(range)
    const existing = summaries.value[key]

    if (!options?.force && existing) {
      if (summaryNeedsFollowUpRefresh(existing)) {
        scheduleSummaryFollowUp(range)
      }
      return existing
    }

    if (!options?.background) {
      summaryStatuses.value[key] = 'pending'
      summaryErrors.value[key] = null
    }

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
      summaryErrors.value[key] = null
      if (summaryNeedsFollowUpRefresh(data)) {
        scheduleSummaryFollowUp(range)
      } else {
        clearSummaryFollowUp(key)
      }
      return data
    } catch (error) {
      if (!options?.background) {
        summaryStatuses.value[key] = 'error'
        summaryErrors.value[key] = toErrorMessage(error)
      }
      throw error
    }
  }

  async function fetchDetail(
    appName: string,
    options?: { range?: AnalyticsRange; force?: boolean; background?: boolean },
  ) {
    const range = options?.range ?? currentRange()
    const key = detailKey(appName, range)
    const existing = details.value[key]

    if (!options?.force && existing) {
      if (detailNeedsFollowUpRefresh(existing)) {
        scheduleDetailFollowUp(appName, range)
      }
      return existing
    }

    if (!options?.background) {
      detailStatuses.value[key] = 'pending'
      detailErrors.value[key] = null
    }

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
      detailErrors.value[key] = null
      if (detailNeedsFollowUpRefresh(data)) {
        scheduleDetailFollowUp(appName, range)
      } else {
        clearDetailFollowUp(key)
      }
      return data
    } catch (error) {
      if (!options?.background) {
        detailStatuses.value[key] = 'error'
        detailErrors.value[key] = toErrorMessage(error)
      }
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
