import type { MaybeRefOrGetter } from 'vue'

export type DatePreset = '1h' | 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'custom'

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

function formatDate(d: Date): string {
    return d.toISOString().split('T')[0]!
}

function computeDates(preset: DatePreset): { startDate: string; endDate: string } {
    const now = new Date()
    const end = formatDate(now)

    switch (preset) {
        case '1h': {
            const s = new Date(now)
            s.setHours(s.getHours() - 1)
            return { startDate: s.toISOString(), endDate: now.toISOString() }
        }
        case 'today':
            return { startDate: end, endDate: end }
        case 'yesterday': {
            const y = new Date(now)
            y.setDate(y.getDate() - 1)
            return { startDate: formatDate(y), endDate: formatDate(y) }
        }
        case '7d': {
            const s = new Date(now)
            s.setDate(s.getDate() - 7)
            return { startDate: formatDate(s), endDate: end }
        }
        case '30d': {
            const s = new Date(now)
            s.setDate(s.getDate() - 30)
            return { startDate: formatDate(s), endDate: end }
        }
        case '90d': {
            const s = new Date(now)
            s.setDate(s.getDate() - 90)
            return { startDate: formatDate(s), endDate: end }
        }
        case 'custom':
            return { startDate: end, endDate: end }
    }
}

/**
 * Shared composable for analytics date range management.
 * Used by GA, GSC, and PostHog panels for consistent date selection.
 *
 * @param defaultPreset - The initial preset to use (default: 'today')
 */
export function useAnalyticsDateRange(defaultPreset: MaybeRefOrGetter<DatePreset> = 'today') {
    const preset = ref<DatePreset>(toValue(defaultPreset))
    const initial = computeDates(preset.value)
    const startDate = ref(initial.startDate)
    const endDate = ref(initial.endDate)

    const presetOptions = Object.entries(PRESET_LABELS)
        .map(([value, label]) => ({ value: value as DatePreset, label }))

    function setPreset(p: DatePreset) {
        preset.value = p
        if (p !== 'custom') {
            const dates = computeDates(p)
            startDate.value = dates.startDate
            endDate.value = dates.endDate
        }
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
