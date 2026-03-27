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

const metricColumns = [
  { key: 'events', label: 'Events' },
  { key: 'users', label: 'Users' },
  { key: 'pageviews', label: 'Pageviews' },
] satisfies AnalyticsProviderFleetMetricColumn[]

const rows = computed<AnalyticsProviderFleetTableRow[]>(() =>
  [...props.apps]
    .map((app) => {
      const snapshot = props.snapshotMap[app.name]
      const summary = snapshot?.posthog.metrics?.summary
      const status = snapshot?.posthog.status ?? 'error'

      return {
        appName: app.name,
        href: analyticsSurfaceHref('posthog', app.name),
        hint: snapshot?.app.posthogAppName
          ? `Project ${snapshot.app.posthogAppName}`
          : 'Using app slug fallback',
        status,
        message: snapshot?.posthog.message ?? 'PostHog snapshot not loaded yet.',
        metrics: {
          events: {
            display: formatNumber(summary?.event_count),
            sortValue: Number(summary?.event_count ?? 0),
          },
          users: {
            display: formatNumber(summary?.unique_users),
            sortValue: Number(summary?.unique_users ?? 0),
          },
          pageviews: {
            display: formatNumber(summary?.pageviews),
            sortValue: Number(summary?.pageviews ?? 0),
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
      <span>Product analytics stays isolated from acquisition metrics and indexing work.</span>
      <span class="text-xs text-muted">Click table headers to sort the fleet snapshot.</span>
    </div>

    <AnalyticsProviderFleetTable
      :rows="rows"
      :metric-columns="metricColumns"
      :loading="loading"
      :empty-message="loading ? 'Loading PostHog fleet state…' : 'No PostHog snapshots found.'"
    />
  </div>
</template>
