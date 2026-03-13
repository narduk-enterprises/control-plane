<script setup lang="ts">
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

// Data is loaded natively by Nuxt useFetch reactivity on the URL hook

const summary = computed(() => {
  const d = data.value as { summary: Record<string, number> | null } | null
  if (!d?.summary || typeof d.summary !== 'object') return null
  const s = d.summary
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
  const d = data.value as { deltas: Record<string, number> | null } | null
  return d?.deltas ?? null
})

const dateRange = computed(() => {
  const d = data.value as { startDate?: string; endDate?: string } | null
  if (!d?.startDate || !d?.endDate) return null
  return `${d.startDate} → ${d.endDate}`
})

function onPresetChange(p: string) {
  setPreset(p as Parameters<typeof setPreset>[0])
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
