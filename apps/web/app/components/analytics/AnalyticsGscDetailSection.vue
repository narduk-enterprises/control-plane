<script setup lang="ts">
import type { FleetAnalyticsGscMetrics, StatCardConfig } from '~/types/analytics'

const props = defineProps<{
  metrics: FleetAnalyticsGscMetrics | null
  startDate: string
  endDate: string
}>()

const cards = computed<StatCardConfig[]>(() => {
  const totals = props.metrics?.totals
  if (!totals) return []

  return [
    { label: 'Clicks', value: totals.clicks, format: 'number' },
    { label: 'Impressions', value: totals.impressions, format: 'number' },
    { label: 'CTR', value: totals.ctr, format: 'percent' },
    { label: 'Avg Position', value: totals.position, format: 'number' },
  ]
})

const clickSeries = computed(() =>
  (props.metrics?.timeSeries ?? []).map((point) => ({ date: point.date, value: point.clicks })),
)
</script>

<template>
  <div class="space-y-4">
    <div v-if="cards.length" id="search-console" class="grid gap-3 grid-cols-2 sm:grid-cols-4">
      <AnalyticsStatCard v-for="card in cards" :key="card.label" v-bind="card" compact />
    </div>

    <UCard v-if="clickSeries.length">
      <template #header>
        <h2 class="text-sm font-medium text-default">Search Console Clicks</h2>
      </template>
      <AnalyticsLineChart :data="clickSeries" :title="`${startDate} to ${endDate}`" />
    </UCard>

    <AnalyticsGscTopQueries
      v-if="metrics"
      :queries="metrics.queries.slice(0, 10)"
      :devices="metrics.devices.slice(0, 5)"
    />

    <AnalyticsGscInspection
      v-if="metrics?.inspection?.indexStatusResult"
      :inspection="metrics.inspection"
    />

    <UCard v-if="!metrics?.totals && !clickSeries.length">
      <p class="text-sm text-muted">
        No Search Console metrics were returned for this range. Check property access and coverage.
      </p>
    </UCard>
  </div>
</template>
