<script setup lang="ts">
import type { FleetAnalyticsSnapshot } from '~/types/analytics'
import type {
  AnalyticsProviderFleetMetricColumn,
  AnalyticsProviderFleetTableRow,
} from '~/types/analyticsFleetTable'
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

const metricColumns = [
  { key: 'clicks', label: 'Clicks' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'ctr', label: 'CTR' },
] satisfies AnalyticsProviderFleetMetricColumn[]

const rows = computed<AnalyticsProviderFleetTableRow[]>(() =>
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
        metrics: {
          clicks: {
            display: formatNumber(totals?.clicks),
            sortValue: Number(totals?.clicks ?? 0),
          },
          impressions: {
            display: formatNumber(totals?.impressions),
            sortValue: Number(totals?.impressions ?? 0),
          },
          ctr: {
            display: formatPercent(totals?.ctr),
            sortValue: Number(totals?.ctr ?? 0),
          },
        },
      }
    })
    .sort((left, right) => left.appName.localeCompare(right.appName)),
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
      <span class="text-xs text-muted">Click table headers to sort the fleet snapshot.</span>
    </div>

    <AnalyticsProviderFleetTable
      :rows="rows"
      :metric-columns="metricColumns"
      :loading="loading"
      :empty-message="
        loading ? 'Loading Search Console fleet state…' : 'No Search Console snapshots found.'
      "
    />
  </div>
</template>
