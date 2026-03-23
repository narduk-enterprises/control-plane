<script setup lang="ts">
import type { FleetAnalyticsGscMetrics, StatCardConfig } from '~/types/analytics'

const props = defineProps<{
  metrics: FleetAnalyticsGscMetrics | null
  startDate: string
  endDate: string
  loading?: boolean
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

const hasInspection = computed(() => Boolean(props.metrics?.inspection?.indexStatusResult))
const hasPerformanceData = computed(
  () =>
    (props.metrics?.totals?.clicks ?? 0) > 0 ||
    (props.metrics?.totals?.impressions ?? 0) > 0 ||
    clickSeries.value.length > 0 ||
    (props.metrics?.queries.length ?? 0) > 0 ||
    (props.metrics?.pages.length ?? 0) > 0 ||
    (props.metrics?.devices.length ?? 0) > 0 ||
    (props.metrics?.searchAppearances.length ?? 0) > 0,
)
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="metrics?.note || (hasInspection && !hasPerformanceData)"
      icon="i-lucide-info"
      color="info"
      variant="subtle"
      :description="
        metrics?.note ||
        'Search Console has indexing context for this app, but no performance data has landed for the selected range yet.'
      "
    />

    <div v-if="cards.length" id="search-console" class="grid gap-3 grid-cols-2 sm:grid-cols-4">
      <AnalyticsStatCard v-for="card in cards" :key="card.label" v-bind="card" compact />
    </div>

    <UCard v-if="clickSeries.length">
      <template #header>
        <h2 class="text-sm font-medium text-default">Search Console Clicks</h2>
      </template>
      <AnalyticsLineChart :data="clickSeries" :title="`${startDate} to ${endDate}`" />
    </UCard>

    <div class="grid gap-4 lg:grid-cols-2">
      <AnalyticsGscRowsCard
        title="Top Queries"
        icon="i-lucide-search"
        label="Query"
        :rows="metrics?.queries.slice(0, 10) ?? []"
      />
      <AnalyticsGscRowsCard
        title="Top Pages"
        icon="i-lucide-file-text"
        label="Page"
        :rows="metrics?.pages.slice(0, 10) ?? []"
      />
      <AnalyticsGscRowsCard
        title="Devices"
        icon="i-lucide-smartphone"
        label="Device"
        :rows="metrics?.devices.slice(0, 5) ?? []"
      />
      <AnalyticsGscRowsCard
        title="Search Appearance"
        icon="i-lucide-sparkles"
        label="Appearance"
        :rows="metrics?.searchAppearances.slice(0, 5) ?? []"
      />
    </div>

    <AnalyticsGscInspection
      v-if="metrics?.inspection?.indexStatusResult"
      :inspection="metrics.inspection"
    />

    <UCard v-if="loading && !hasPerformanceData && !hasInspection">
      <p class="text-sm text-muted">Loading Search Console detail…</p>
    </UCard>

    <UCard v-else-if="!hasPerformanceData && !hasInspection">
      <p class="text-sm text-muted">
        No Search Console metrics were returned for this range. Check property access, indexing, and
        coverage.
      </p>
    </UCard>
  </div>
</template>
