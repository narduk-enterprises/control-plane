<script setup lang="ts">
import type { FleetAnalyticsSummaryResponse, StatCardConfig } from '~/types/analytics'

const props = defineProps<{
  summary: FleetAnalyticsSummaryResponse | null
  loading?: boolean
}>()

const totals = computed(() => props.summary?.totals ?? null)

const statCards = computed<StatCardConfig[]>(() => {
  if (!totals.value) return []

  return [
    {
      label: 'GA4 Users',
      value: totals.value.gaUsers || undefined,
      icon: 'i-lucide-activity',
      iconColor: 'bg-sky-500/10 text-sky-600',
    },
    {
      label: 'GA4 Pageviews',
      value: totals.value.gaPageviews || undefined,
      icon: 'i-lucide-file-chart-column',
      iconColor: 'bg-sky-500/10 text-sky-600',
    },
    {
      label: 'GSC Clicks',
      value: totals.value.gscClicks || undefined,
      icon: 'i-lucide-mouse-pointer-click',
      iconColor: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      label: 'GSC Impressions',
      value: totals.value.gscImpressions || undefined,
      icon: 'i-lucide-eye',
      iconColor: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      label: 'PostHog Events',
      value: totals.value.posthogEvents || undefined,
      icon: 'i-lucide-waveform',
      iconColor: 'bg-amber-500/10 text-amber-600',
    },
    {
      label: 'PostHog Users',
      value: totals.value.posthogUsers || undefined,
      icon: 'i-lucide-users',
      iconColor: 'bg-amber-500/10 text-amber-600',
    },
  ]
})

const providerStatuses = computed(() => {
  if (!totals.value || !props.summary) return []
  const totalApps = Object.keys(props.summary.apps).length
  return [
    {
      key: 'ga',
      label: 'GA4',
      healthy: totals.value.healthyProviders.ga,
      problem: totals.value.problemProviders.ga,
      totalApps,
      icon: 'i-lucide-activity',
    },
    {
      key: 'gsc',
      label: 'GSC',
      healthy: totals.value.healthyProviders.gsc,
      problem: totals.value.problemProviders.gsc,
      totalApps,
      icon: 'i-lucide-search',
    },
    {
      key: 'posthog',
      label: 'PostHog',
      healthy: totals.value.healthyProviders.posthog,
      problem: totals.value.problemProviders.posthog,
      totalApps,
      icon: 'i-lucide-waveform',
    },
    {
      key: 'indexnow',
      label: 'IndexNow',
      healthy: totals.value.healthyProviders.indexnow,
      problem: totals.value.problemProviders.indexnow,
      totalApps,
      icon: 'i-lucide-send',
    },
  ]
})
</script>

<template>
  <div class="mb-6 space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <div
        v-for="provider in providerStatuses"
        :key="provider.key"
        class="flex items-center gap-2 rounded-full border border-default bg-elevated/40 px-3 py-1.5 text-xs"
      >
        <UIcon :name="provider.icon" class="size-3.5 text-primary" />
        <span class="font-medium text-default">{{ provider.label }}</span>
        <span class="text-success">{{ provider.healthy }}/{{ provider.totalApps }}</span>
        <span v-if="provider.problem > 0" class="text-warning">
          · {{ provider.problem }} issue{{ provider.problem === 1 ? '' : 's' }}
        </span>
      </div>
    </div>

    <div v-if="statCards.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <AnalyticsStatCard v-for="card in statCards" :key="card.label" v-bind="card" :loading="loading" />
    </div>

    <div
      v-else-if="!loading"
      class="rounded-xl border border-dashed border-default bg-elevated/20 px-5 py-6 text-center"
    >
      <UIcon name="i-lucide-database-zap" class="mx-auto mb-2 size-8 text-muted" />
      <p class="font-medium text-default">No analytics snapshot available</p>
      <p class="mt-1 text-sm text-muted">
        Refresh the fleet snapshot after GA4, Search Console, or PostHog access is fixed.
      </p>
    </div>
  </div>
</template>
