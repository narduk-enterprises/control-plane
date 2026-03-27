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
  return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '0.0%'
}

const metricColumns = [
  { key: 'users', label: 'Users' },
  { key: 'pageviews', label: 'Pageviews' },
  { key: 'engagement', label: 'Engagement' },
] satisfies AnalyticsProviderFleetMetricColumn[]

const rows = computed<AnalyticsProviderFleetTableRow[]>(() =>
  [...props.apps]
    .map((app) => {
      const snapshot = props.snapshotMap[app.name]
      const summary = snapshot?.ga.metrics?.summary
      return {
        appName: app.name,
        href: analyticsSurfaceHref('ga', app.name),
        hint: snapshot?.app.gaPropertyId
          ? `Property ${snapshot.app.gaPropertyId}`
          : 'No GA4 property configured',
        status: snapshot?.ga.status ?? 'error',
        message: snapshot?.ga.message ?? 'GA4 snapshot not loaded yet.',
        metrics: {
          users: {
            display: formatNumber(summary?.activeUsers),
            sortValue: Number(summary?.activeUsers ?? 0),
          },
          pageviews: {
            display: formatNumber(summary?.screenPageViews),
            sortValue: Number(summary?.screenPageViews ?? 0),
          },
          engagement: {
            display: formatPercent(summary?.engagementRate),
            sortValue: Number(summary?.engagementRate ?? 0),
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
      <span>GA4 metrics stay in the canonical summary cache and sort by current users.</span>
      <span class="text-xs text-muted">Click table headers to sort the fleet snapshot.</span>
    </div>

    <AnalyticsProviderFleetTable
      :rows="rows"
      :metric-columns="metricColumns"
      :loading="loading"
      :empty-message="loading ? 'Loading GA4 fleet state…' : 'No GA4 snapshots found.'"
    />
  </div>
</template>
