<script setup lang="ts">
import type { FleetAnalyticsPosthogMetrics, StatCardConfig } from '~/types/analytics'

const props = defineProps<{
  metrics: FleetAnalyticsPosthogMetrics | null
  loading?: boolean
}>()

const cards = computed<StatCardConfig[]>(() => {
  if (!props.metrics) return []

  return [
    {
      label: 'Events',
      value: Number(props.metrics.summary.event_count ?? 0),
      format: 'number',
    },
    {
      label: 'Unique Users',
      value: Number(props.metrics.summary.unique_users ?? 0),
      format: 'number',
    },
    {
      label: 'Pageviews',
      value: Number(props.metrics.summary.pageviews ?? 0),
      format: 'number',
    },
    {
      label: 'Sessions',
      value: Number(props.metrics.summary.sessions ?? 0),
      format: 'number',
    },
  ]
})

const breakdowns = computed(() => [
  {
    title: 'Top Pages',
    icon: 'i-lucide-file-text',
    items: props.metrics?.topPages ?? [],
  },
  {
    title: 'Top Referrers',
    icon: 'i-lucide-arrow-up-right',
    items: props.metrics?.topReferrers ?? [],
  },
  {
    title: 'Top Countries',
    icon: 'i-lucide-globe',
    items: props.metrics?.topCountries ?? [],
  },
  {
    title: 'Top Browsers',
    icon: 'i-lucide-monitor',
    items: props.metrics?.topBrowsers ?? [],
  },
  {
    title: 'Top Events',
    icon: 'i-lucide-sparkles',
    items: props.metrics?.topEvents ?? [],
  },
])
</script>

<template>
  <AnalyticsTrafficDetailShell
    :cards="cards"
    :chart-data="metrics?.timeSeries ?? []"
    chart-title="PostHog Event Volume"
    :breakdowns="breakdowns"
    :loading="loading"
    empty-message="No PostHog metrics were returned for this range. Check project access or event activity."
  />
</template>
