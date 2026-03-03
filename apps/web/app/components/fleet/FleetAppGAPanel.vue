<script setup lang="ts">
const props = defineProps<{ appName: string }>()

const { data, error, loading, load } = useFleetGA(() => props.appName)

const summary = computed(() => {
  const d = data.value as { summary: Record<string, number> } | null
  if (!d || typeof d.summary !== 'object') return null
  const s = d.summary
  return {
    users: s.activeUsers,
    sessions: s.sessions,
    pageviews: s.screenPageViews,
    bounceRate: s.bounceRate,
    avgSessionDuration: s.averageSessionDuration,
  }
})

const dateRange = computed(() => {
  const d = data.value as { startDate?: string; endDate?: string } | null
  if (!d?.startDate || !d?.endDate) return null
  return `${d.startDate} → ${d.endDate}`
})

async function onLoad() {
  await load()
}
</script>

<template>
  <FleetSharedAnalyticsCard
    provider-name="Google Analytics"
    icon-name="i-lucide-bar-chart-2"
    :loading="loading"
    :error="error || null"
    :summary="summary"
    :date-range="dateRange"
    @load="onLoad"
  />
</template>
