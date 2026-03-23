<script setup lang="ts">
import type { FleetAnalyticsPosthogMetrics, StatCardConfig } from '~/types/analytics'

const props = defineProps<{
  metrics: FleetAnalyticsPosthogMetrics | null
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
</script>

<template>
  <div class="space-y-4">
    <div v-if="cards.length" class="grid gap-3 grid-cols-2 sm:grid-cols-4">
      <AnalyticsStatCard v-for="card in cards" :key="card.label" v-bind="card" compact />
    </div>

    <UCard v-if="metrics?.timeSeries?.length">
      <template #header>
        <h2 class="text-sm font-medium text-default">PostHog Events</h2>
      </template>
      <AnalyticsLineChart :data="metrics.timeSeries" title="Event volume" />
    </UCard>

    <div class="grid gap-4 md:grid-cols-2">
      <FleetTopDimensionCard
        title="Top Pages"
        icon="i-lucide-file-text"
        :items="metrics?.topPages ?? []"
      />
      <FleetTopDimensionCard
        title="Top Referrers"
        icon="i-lucide-arrow-up-right"
        :items="metrics?.topReferrers ?? []"
      />
      <FleetTopDimensionCard
        title="Top Countries"
        icon="i-lucide-globe"
        :items="metrics?.topCountries ?? []"
      />
      <FleetTopDimensionCard
        title="Top Browsers"
        icon="i-lucide-monitor"
        :items="metrics?.topBrowsers ?? []"
      />
    </div>

    <UCard v-if="!metrics">
      <p class="text-sm text-muted">
        No PostHog metrics were returned for this range. Check project access or event activity.
      </p>
    </UCard>
  </div>
</template>
