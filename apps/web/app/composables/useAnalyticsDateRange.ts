import { storeToRefs } from 'pinia'
import { useAnalyticsStore } from '~/stores/analytics'
import type { AnalyticsDatePreset } from '~/types/store'

export type DatePreset = AnalyticsDatePreset

export interface DateRange {
  startDate: string
  endDate: string
  preset: DatePreset
}

const PRESET_LABELS: Record<DatePreset, string> = {
  '1h': 'Last Hour',
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
  custom: 'Custom',
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? ''
}

function computeDates(preset: DatePreset): { startDate: string; endDate: string } {
  const now = new Date()
  const endDate = formatDate(now)

  switch (preset) {
    case '1h':
      return { startDate: new Date(now.getTime() - 60 * 60 * 1000).toISOString(), endDate: now.toISOString() }
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

export function useAnalyticsDateRange(defaultPreset: DatePreset = 'today') {
  const store = useAnalyticsStore()
  const { initialized, preset, startDate, endDate } = storeToRefs(store)

  const defaultRange = computeDates(defaultPreset)
  if (!initialized.value) {
    store.setPreset(defaultPreset)
  } else if (!startDate.value || !endDate.value) {
    store.setCustomRange(defaultRange)
  }

  const presetOptions = Object.entries(PRESET_LABELS).map(([value, label]) => ({
    value: value as DatePreset,
    label,
  }))

  function setPreset(nextPreset: DatePreset) {
    store.setPreset(nextPreset)
  }

  const presetLabel = computed(() => PRESET_LABELS[preset.value])
  const isToday = computed(() => preset.value === 'today')
  const is1h = computed(() => preset.value === '1h')

  return {
    preset,
    startDate,
    endDate,
    presetOptions,
    presetLabel,
    isToday,
    is1h,
    setPreset,
  }
}
