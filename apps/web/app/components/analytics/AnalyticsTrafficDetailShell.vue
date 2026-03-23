<script setup lang="ts">
import type { AnalyticsTopListItem, GaTimeSeriesPoint, StatCardConfig } from '~/types/analytics'

interface TrafficBreakdown {
  title: string
  icon: string
  items: AnalyticsTopListItem[]
}

const props = withDefaults(
  defineProps<{
    cards: StatCardConfig[]
    chartData?: GaTimeSeriesPoint[]
    chartTitle?: string
    note?: string | null
    breakdowns?: TrafficBreakdown[]
    loading?: boolean
    emptyMessage: string
  }>(),
  {
    chartData: () => [],
    chartTitle: '',
    note: null,
    breakdowns: () => [],
    loading: false,
  },
)

const visibleBreakdowns = computed(() =>
  props.breakdowns.filter((breakdown) => breakdown.items.length > 0),
)

const hasContent = computed(
  () =>
    props.cards.length > 0 ||
    props.chartData.length > 0 ||
    visibleBreakdowns.value.length > 0 ||
    Boolean(props.note),
)
</script>

<template>
  <div class="space-y-4">
    <UAlert v-if="note" icon="i-lucide-info" color="info" variant="subtle" :description="note" />

    <div v-if="cards.length" class="grid gap-3 grid-cols-2 sm:grid-cols-4">
      <AnalyticsStatCard v-for="card in cards" :key="card.label" v-bind="card" compact />
    </div>

    <UCard v-if="chartData.length">
      <template #header>
        <h2 class="text-sm font-medium text-default">{{ chartTitle }}</h2>
      </template>
      <AnalyticsLineChart :data="chartData" />
    </UCard>

    <div v-if="visibleBreakdowns.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <FleetTopDimensionCard
        v-for="breakdown in visibleBreakdowns"
        :key="breakdown.title"
        :title="breakdown.title"
        :icon="breakdown.icon"
        :items="breakdown.items"
      />
    </div>

    <UCard v-if="loading && !hasContent">
      <p class="text-sm text-muted">Loading analytics detail…</p>
    </UCard>

    <UCard v-else-if="!hasContent">
      <p class="text-sm text-muted">
        {{ emptyMessage }}
      </p>
    </UCard>
  </div>
</template>
