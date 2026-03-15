<script setup lang="ts">
import type { GaSummary, GaDeltas } from '~/types/analytics'
import type { DatePreset } from '~/composables/useAnalyticsDateRange'

const props = defineProps<{ appName: string; active?: boolean }>()

const { preset, startDate, endDate, presetOptions, presetLabel, setPreset } =
  useAnalyticsDateRange('today')
const force = ref(false)
const { data, error, loading, load } = useFleetGA(() => props.appName, startDate, endDate, force)

async function onForceRefresh() {
  force.value = true
  await load()
  force.value = false
}

const summary = computed(() => {
  const s = data.value?.summary as GaSummary | null
  if (!s) return null
  return {
    users: s.activeUsers,
    newUsers: s.newUsers,
    sessions: s.sessions,
    pageviews: s.screenPageViews,
    bounceRate: s.bounceRate,
    avgSessionDuration: s.averageSessionDuration,
    engagementRate: s.engagementRate,
    eventCount: s.eventCount,
  }
})

const deltas = computed(() => {
  const d = data.value?.deltas as GaDeltas | null
  return d ?? null
})

const dateRange = computed(() => {
  const d = data.value
  if (!d?.startDate || !d?.endDate) return null
  return `${d.startDate} → ${d.endDate}`
})

function onPresetChange(p: DatePreset) {
  setPreset(p)
}
</script>

<template>
  <FleetSharedAnalyticsCard
    provider-name="Google Analytics"
    icon-name="i-lucide-bar-chart-2"
    :loading="loading"
    :error="error || null"
    :summary="summary"
    :deltas="deltas"
    :time-series="data?.timeSeries"
    :date-range="dateRange"
    :preset-options="presetOptions"
    :active-preset="preset"
    :preset-label="presetLabel"
    v-model:start-date="startDate"
    v-model:end-date="endDate"
    @load="load"
    @preset="onPresetChange"
    @refresh="onForceRefresh"
  />
</template>
