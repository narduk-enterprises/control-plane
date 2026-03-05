<script setup lang="ts">
import type { DatePreset } from '~/composables/useAnalyticsDateRange'

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

function formatDelta(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return ''
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

function getDeltaClass(value: number | undefined): string {
  if (value === undefined) return 'text-muted'
  return value >= 0 ? 'text-success' : 'text-error'
}

function getInvertedDeltaClass(value: number | undefined): string {
  if (value === undefined) return 'text-muted'
  return value <= 0 ? 'text-success' : 'text-error'
}

function formatSeconds(seconds: number | undefined): string {
  if (seconds === undefined) return ''
  if (seconds >= 60) {
    return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`
  }
  return `${Math.round(seconds)}s`
}

function getPresetColor(optValue: DatePreset) {
  return props.activePreset === optValue ? 'primary' : 'neutral'
}

function getPresetVariant(optValue: DatePreset) {
  return props.activePreset === optValue ? 'solid' : 'outline'
}

const isMounted = ref(false)
onMounted(() => {
  isMounted.value = true
})

const refreshIcon = computed(() => (isMounted.value && props.loading) ? 'i-lucide-loader-2' : 'i-lucide-refresh-cw')
const refreshColor = computed(() => (isMounted.value && props.loading) ? 'primary' : 'neutral')

function onUpdateStartDate(val: string | number) { emit('update:startDate', String(val)) }
function onUpdateEndDate(val: string | number) { emit('update:endDate', String(val)) }

const showLoadButton = computed(() => !props.hideButton && !props.presetOptions?.length)
const showChart = computed(() => !!props.timeSeries && props.timeSeries.length > 0)
const showEmptyState = computed(() => !props.summary && !(isMounted.value && props.loading))
const chartTitle = computed(() => props.presetLabel ? `Trend (${props.presetLabel})` : 'Trend')

function onPresetClick(val: DatePreset) {
  emit('preset', val)
}
</script>

<template>
  <div class="space-y-4">
    <!-- Date Range Presets -->
    <div v-if="presetOptions?.length" class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          v-for="opt in presetOptions"
          :key="opt.value"
          size="xs"
          :color="getPresetColor(opt.value)"
          :variant="getPresetVariant(opt.value)"
          class="cursor-pointer rounded-full"
          @click="onPresetClick(opt.value)"
        >
          {{ opt.label }}
        </UButton>

        <div class="flex-1" />

        <UButton
          :color="refreshColor"
          variant="ghost"
          :icon="refreshIcon"
          size="xs"
          class="cursor-pointer text-muted hover:text-default"
          :loading="isMounted && loading"
          @click="$emit('refresh')"
        >
          Force Refresh
        </UButton>
      </div>

      <div v-if="activePreset === 'custom'" class="flex flex-wrap items-center gap-2 border-t border-default pt-3">
        <UInput 
          type="date" 
          :model-value="startDate" 
          @update:model-value="onUpdateStartDate" 
          size="xs" 
          class="w-auto"
        />
        <span class="text-xs text-muted">to</span>
        <UInput 
          type="date" 
          :model-value="endDate" 
          @update:model-value="onUpdateEndDate" 
          size="xs" 
          class="w-auto"
        />
      </div>
    </div>

    <UButton
      v-if="showLoadButton"
      :loading="isMounted && loading"
      class="cursor-pointer"
      @click="$emit('load')"
    >
      Load {{ providerName }}
    </UButton>

    <div v-if="error" class="rounded-lg border border-error/30 bg-error/5 p-4">
      <p class="text-sm font-medium text-error">{{ providerName }} error</p>
      <p class="mt-1 text-sm text-muted">{{ error.message || 'An unknown error occurred' }}</p>
    </div>

    <!-- Skeletons -->
    <div v-else-if="!summary && isMounted && loading" class="space-y-4 animate-pulse">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="i in 4" :key="i" class="rounded-xl border border-default bg-elevated/30 p-4 h-[104px] flex flex-col justify-center">
          <div class="h-4 w-24 bg-default/10 rounded mb-3"></div>
          <div class="h-8 w-16 bg-default/10 rounded"></div>
        </div>
      </div>
      <div v-if="providerName !== 'PostHog'" class="mt-4 h-[300px] rounded-lg bg-default/5"></div>
    </div>

    <div v-else-if="summary" class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <!-- Users -->
        <div v-if="summary.users !== undefined" class="rounded-xl border border-default bg-elevated/30 p-4">
          <p class="text-sm font-medium text-muted">Unique Users</p>
          <p class="mt-1 text-2xl font-semibold text-default">
            {{ summary.users.toLocaleString() }}
          </p>
          <p v-if="deltas?.users !== undefined" class="mt-0.5 text-xs" :class="getDeltaClass(deltas.users)">
            {{ formatDelta(deltas.users) }} vs prev
          </p>
        </div>

        <!-- New Users (GA Specific) -->
        <div v-if="summary.newUsers !== undefined" class="rounded-xl border border-default bg-elevated/30 p-4">
          <p class="text-sm font-medium text-muted">New Users</p>
          <p class="mt-1 text-2xl font-semibold text-default">
            {{ summary.newUsers.toLocaleString() }}
          </p>
          <p v-if="deltas?.newUsers !== undefined" class="mt-0.5 text-xs" :class="getDeltaClass(deltas.newUsers)">
            {{ formatDelta(deltas.newUsers) }} vs prev
          </p>
        </div>

        <!-- Sessions -->
        <div v-if="summary.sessions !== undefined" class="rounded-xl border border-default bg-elevated/30 p-4">
          <p class="text-sm font-medium text-muted">Sessions</p>
          <p class="mt-1 text-2xl font-semibold text-default">
            {{ summary.sessions.toLocaleString() }}
          </p>
          <p v-if="deltas?.sessions !== undefined" class="mt-0.5 text-xs" :class="getDeltaClass(deltas.sessions)">
            {{ formatDelta(deltas.sessions) }} vs prev
          </p>
        </div>

        <!-- Pageviews -->
        <div v-if="summary.pageviews !== undefined" class="rounded-xl border border-default bg-elevated/30 p-4">
          <p class="text-sm font-medium text-muted">Pageviews</p>
          <p class="mt-1 text-2xl font-semibold text-default">
            {{ summary.pageviews.toLocaleString() }}
          </p>
          <p v-if="deltas?.pageviews !== undefined" class="mt-0.5 text-xs" :class="getDeltaClass(deltas.pageviews)">
            {{ formatDelta(deltas.pageviews) }} vs prev
          </p>
        </div>

        <!-- Event Count (PostHog Specific) -->
        <div v-if="summary.eventCount !== undefined && summary.eventCount > 0" class="rounded-xl border border-default bg-elevated/30 p-4">
          <p class="text-sm font-medium text-muted">Total Events</p>
          <p class="mt-1 text-2xl font-semibold text-default">
            {{ summary.eventCount.toLocaleString() }}
          </p>
        </div>

        <!-- Bounce Rate (GA Specific) -->
        <div v-if="summary.bounceRate !== undefined" class="rounded-xl border border-default bg-elevated/30 p-4">
          <p class="text-sm font-medium text-muted">Bounce Rate</p>
          <p class="mt-1 text-2xl font-semibold text-default">
            {{ (summary.bounceRate * 100).toFixed(1) }}%
          </p>
          <p v-if="deltas?.bounceRate !== undefined" class="mt-0.5 text-xs" :class="getInvertedDeltaClass(deltas.bounceRate)">
            {{ formatDelta(deltas.bounceRate) }} vs prev
          </p>
        </div>

        <!-- Engagement Rate (GA Specific) -->
        <div v-if="summary.engagementRate !== undefined" class="rounded-xl border border-default bg-elevated/30 p-4">
          <p class="text-sm font-medium text-muted">Engagement Rate</p>
          <p class="mt-1 text-2xl font-semibold text-default">
            {{ (summary.engagementRate * 100).toFixed(1) }}%
          </p>
        </div>

        <!-- Avg Session Duration (GA Specific) -->
        <div v-if="summary.avgSessionDuration !== undefined" class="rounded-xl border border-default bg-elevated/30 p-4">
          <p class="text-sm font-medium text-muted">Avg Session</p>
          <p class="mt-1 text-2xl font-semibold text-default">
            {{ formatSeconds(summary.avgSessionDuration) }}
          </p>
        </div>
      </div>

      <p v-if="dateRange" class="text-xs text-muted">
        {{ dateRange }}
      </p>
    </div>

    <!-- Chart -->
    <div v-if="showChart" class="mt-4">
      <AnalyticsLineChart :data="timeSeries ?? []" :title="chartTitle" />
    </div>

    <div v-else-if="showEmptyState" class="rounded-lg border border-dashed border-default p-6 text-center">
      <UIcon :name="iconName" class="mx-auto size-10 text-muted" />
      <p class="mt-2 text-sm font-medium text-default">{{ providerName }} Analytics</p>
      <p class="mt-1 text-sm text-muted">Select a date range to load metrics.</p>
    </div>
  </div>
</template>
