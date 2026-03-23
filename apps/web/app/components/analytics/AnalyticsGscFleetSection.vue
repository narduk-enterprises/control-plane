<script setup lang="ts">
import type { FleetAnalyticsSnapshot } from '~/types/analytics'
import type { FleetRegistryApp } from '~/types/fleet'
import { analyticsSurfaceHref } from '~/utils/analyticsPresentation'

const props = defineProps<{
  apps: FleetRegistryApp[]
  snapshotMap: Record<string, FleetAnalyticsSnapshot | null>
  loading?: boolean
}>()

function formatNumber(value: number | null | undefined) {
  return typeof value === 'number' ? value.toLocaleString() : '0'
}

function formatPercent(value: number | null | undefined) {
  return typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : '0.00%'
}

const rows = computed(() =>
  [...props.apps]
    .map((app) => {
      const snapshot = props.snapshotMap[app.name]
      const totals = snapshot?.gsc.metrics?.totals
      const siteUrl = snapshot?.gsc.metrics?.siteUrl || snapshot?.app.url
      return {
        appName: app.name,
        href: analyticsSurfaceHref('gsc', app.name),
        hint: siteUrl || 'No Search Console property detected',
        status: snapshot?.gsc.status ?? 'error',
        message: snapshot?.gsc.message ?? 'Search Console snapshot not loaded yet.',
        metrics: [
          { label: 'Clicks', value: formatNumber(totals?.clicks) },
          { label: 'Impressions', value: formatNumber(totals?.impressions) },
          { label: 'CTR', value: formatPercent(totals?.ctr) },
        ],
        sortValue: totals?.clicks ?? -1,
      }
    })
    .sort((left, right) => right.sortValue - left.sortValue || left.appName.localeCompare(right.appName)),
)

const healthyCount = computed(() => rows.value.filter((row) => row.status === 'healthy').length)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2 text-sm text-muted">
      <UBadge color="primary" variant="subtle" size="sm">
        {{ healthyCount }}/{{ rows.length }} healthy
      </UBadge>
      <span>Search Console issues and click volume are isolated from GA4 and PostHog here.</span>
    </div>

    <div
      v-if="loading && !rows.length"
      class="rounded-2xl border border-dashed border-default bg-elevated/20 px-5 py-8 text-center text-sm text-muted"
    >
      Loading Search Console fleet state…
    </div>

    <div v-else class="grid gap-4 lg:grid-cols-2">
      <AnalyticsProviderStateCard
        v-for="row in rows"
        :key="row.appName"
        :app-name="row.appName"
        :href="row.href"
        :status="row.status"
        :message="row.message"
        :hint="row.hint"
        :metrics="row.metrics"
        action-label="Open GSC detail"
      />
    </div>
  </div>
</template>
