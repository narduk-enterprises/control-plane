<script setup lang="ts">
import type { FleetAnalyticsGaMetrics, StatCardConfig } from '~/types/analytics'

const props = defineProps<{
  metrics: FleetAnalyticsGaMetrics | null
  startDate: string
  endDate: string
  loading?: boolean
}>()

const cards = computed<StatCardConfig[]>(() => {
  const summary = props.metrics?.summary
  if (!summary) return []

  return [
    {
      label: 'Users',
      value: summary.activeUsers,
      delta: props.metrics?.deltas?.users,
      format: 'number',
    },
    {
      label: 'Pageviews',
      value: summary.screenPageViews,
      delta: props.metrics?.deltas?.pageviews,
      format: 'number',
    },
    {
      label: 'Events',
      value: summary.eventCount,
      format: 'number',
    },
    { label: 'Engagement', value: summary.engagementRate, format: 'percent' },
  ]
})

const breakdowns = computed(() => [
  {
    title: 'Top Pages / Screens',
    icon: 'i-lucide-file-text',
    items: props.metrics?.topPages ?? [],
  },
  {
    title: 'Top Countries',
    icon: 'i-lucide-globe',
    items: props.metrics?.topCountries ?? [],
  },
  {
    title: 'Top Devices',
    icon: 'i-lucide-smartphone',
    items: props.metrics?.topDevices ?? [],
  },
  {
    title: 'Top Events',
    icon: 'i-lucide-sparkles',
    items: props.metrics?.topEvents ?? [],
  },
])

const chartTitle = computed(() => `GA4 Views · ${props.startDate} to ${props.endDate}`)
</script>

<template>
  <AnalyticsTrafficDetailShell
    :cards="cards"
    :chart-data="metrics?.timeSeries ?? []"
    :chart-title="chartTitle"
    :note="metrics?.note"
    :breakdowns="breakdowns"
    :loading="loading"
    empty-message="No GA4 metrics were returned for this range. Check property access or widen the date range."
  />
</template>
