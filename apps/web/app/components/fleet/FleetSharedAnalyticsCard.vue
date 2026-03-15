<script setup lang="ts">
import type { DatePreset } from '~/composables/useAnalyticsDateRange'
import type { StatCardConfig } from '~/types/analytics'

const props = defineProps<{
  providerName: 'Google Analytics' | 'PostHog'
  loading?: boolean
  error?: Error | null
  summary?: {
    users?: number
    sessions?: number
    pageviews?: number
    bounceRate?: number
    avgSessionDuration?: number
    eventCount?: number
    newUsers?: number
    engagementRate?: number
  } | null
  deltas?: {
    users?: number
    sessions?: number
    pageviews?: number
    bounceRate?: number
    avgSessionDuration?: number
    eventCount?: number
    newUsers?: number
    engagementRate?: number
  } | null
  dateRange?: string | null
  timeSeries?: { date: string; value: number }[]
  iconName: string
  hideButton?: boolean
  presetOptions?: { value: DatePreset; label: string }[]
  activePreset?: DatePreset
  presetLabel?: string
  startDate?: string
  endDate?: string
}>()

const emit = defineEmits<{
  (e: 'load' | 'refresh'): void
  (e: 'preset', preset: DatePreset): void
  (e: 'update:startDate' | 'update:endDate', value: string): void
}>()

const isMounted = ref(false)
onMounted(() => {
  isMounted.value = true
})

function onStartDateUpdate(val: string | undefined) {
  emit('update:startDate', val ?? '')
}
function onEndDateUpdate(val: string | undefined) {
  emit('update:endDate', val ?? '')
}

const showLoadButton = computed(() => !props.hideButton && !props.presetOptions?.length)
const showChart = computed(() => !!props.timeSeries && props.timeSeries.length > 0)
const showEmptyState = computed(() => !props.summary && !(isMounted.value && props.loading))
const chartTitle = computed(() => (props.presetLabel ? `Trend (${props.presetLabel})` : 'Trend'))

// Data-driven stat cards — replaces 8x copy-pasted card divs
const statCards = computed<StatCardConfig[]>(() => {
  const s = props.summary
  const d = props.deltas
  if (!s) return []

  const cards: StatCardConfig[] = []
  if (s.users !== undefined) cards.push({ label: 'Unique Users', value: s.users, delta: d?.users })
  if (s.newUsers !== undefined)
    cards.push({ label: 'New Users', value: s.newUsers, delta: d?.newUsers })
  if (s.sessions !== undefined)
    cards.push({ label: 'Sessions', value: s.sessions, delta: d?.sessions })
  if (s.pageviews !== undefined)
    cards.push({ label: 'Pageviews', value: s.pageviews, delta: d?.pageviews })
  if (s.eventCount !== undefined && s.eventCount > 0)
    cards.push({ label: 'Total Events', value: s.eventCount })
  if (s.bounceRate !== undefined)
    cards.push({
      label: 'Bounce Rate',
      value: s.bounceRate,
      delta: d?.bounceRate,
      format: 'percent',
      invertDelta: true,
    })
  if (s.engagementRate !== undefined)
    cards.push({ label: 'Engagement Rate', value: s.engagementRate, format: 'percent' })
  if (s.avgSessionDuration !== undefined)
    cards.push({ label: 'Avg Session', value: s.avgSessionDuration, format: 'duration' })
  return cards
})
</script>

<template>
  <div class="space-y-4">
    <!-- Date Range Presets -->
    <AnalyticsDateBar
      v-if="presetOptions?.length"
      :preset-options="presetOptions"
      :active-preset="activePreset ?? 'today'"
      :loading="isMounted && loading"
      show-refresh
      :start-date="startDate"
      :end-date="endDate"
      @preset="emit('preset', $event)"
      @refresh="emit('refresh')"
      @update:start-date="onStartDateUpdate"
      @update:end-date="onEndDateUpdate"
    />

    <UButton
      v-if="showLoadButton"
      :loading="isMounted && loading"
      class="cursor-pointer"
      @click="$emit('load')"
    >
      Load {{ providerName }}
    </UButton>

    <AnalyticsErrorAlert
      v-if="error"
      :provider="providerName"
      :error="error"
      @retry="emit('refresh')"
    />

    <!-- Skeletons -->
    <div v-else-if="!summary && isMounted && loading" class="space-y-4 animate-pulse">
      <div class="grid gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="i in 4"
          :key="i"
          class="rounded-xl border border-default bg-elevated/30 p-4 h-[88px] sm:h-[104px]"
        />
      </div>
      <div v-if="providerName !== 'PostHog'" class="mt-4 h-[300px] rounded-lg bg-default/5" />
    </div>

    <div v-else-if="summary" class="space-y-4">
      <div class="grid gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsStatCard
          v-for="card in statCards"
          :key="card.label"
          v-bind="card"
          :loading="isMounted && loading"
          compact
        />
      </div>
      <p v-if="dateRange" class="text-xs text-muted">{{ dateRange }}</p>
    </div>

    <!-- Chart -->
    <div v-if="showChart" class="mt-4">
      <AnalyticsLineChart :data="timeSeries ?? []" :title="chartTitle" />
    </div>

    <div
      v-else-if="showEmptyState"
      class="rounded-lg border border-dashed border-default p-6 text-center"
    >
      <UIcon :name="iconName" class="mx-auto size-10 text-muted" />
      <p class="mt-2 text-sm font-medium text-default">{{ providerName }} Analytics</p>
      <p class="mt-1 text-sm text-muted">Select a date range to load metrics.</p>
    </div>
  </div>
</template>
