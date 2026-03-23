<script setup lang="ts">
import type { FleetAnalyticsGaMetrics, StatCardConfig } from '~/types/analytics'

const props = defineProps<{
  metrics: FleetAnalyticsGaMetrics | null
  startDate: string
  endDate: string
}>()

const cards = computed<StatCardConfig[]>(() => {
  const summary = props.metrics?.summary
  const deltas = props.metrics?.deltas
  if (!summary) return []

  return [
    { label: 'Users', value: summary.activeUsers, delta: deltas?.users, format: 'number' },
    { label: 'Sessions', value: summary.sessions, delta: deltas?.sessions, format: 'number' },
    {
      label: 'Pageviews',
      value: summary.screenPageViews,
      delta: deltas?.pageviews,
      format: 'number',
    },
    { label: 'Engagement', value: summary.engagementRate, format: 'percent' },
  ]
})
</script>

<template>
  <div class="space-y-4">
    <div v-if="cards.length" class="grid gap-3 grid-cols-2 sm:grid-cols-4">
      <AnalyticsStatCard v-for="card in cards" :key="card.label" v-bind="card" compact />
    </div>

    <UCard v-if="metrics?.timeSeries?.length">
      <template #header>
        <h2 class="text-sm font-medium text-default">GA4 Pageviews</h2>
      </template>
      <AnalyticsLineChart :data="metrics.timeSeries" :title="`${startDate} to ${endDate}`" />
    </UCard>

    <UCard v-if="!metrics?.summary && !metrics?.timeSeries?.length">
      <p class="text-sm text-muted">
        No GA4 metrics were returned for this range. Check property access or widen the date range.
      </p>
    </UCard>
  </div>
</template>
