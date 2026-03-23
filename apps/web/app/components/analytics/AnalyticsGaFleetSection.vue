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
  return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '0.0%'
}

const rows = computed(() =>
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
        metrics: [
          { label: 'Users', value: formatNumber(summary?.activeUsers) },
          { label: 'Pageviews', value: formatNumber(summary?.screenPageViews) },
          { label: 'Engagement', value: formatPercent(summary?.engagementRate) },
        ],
        sortValue: summary?.activeUsers ?? -1,
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
      <span>GA4 metrics stay in the canonical summary cache and sort by current users.</span>
    </div>

    <div
      v-if="loading && !rows.length"
      class="rounded-2xl border border-dashed border-default bg-elevated/20 px-5 py-8 text-center text-sm text-muted"
    >
      Loading GA4 fleet state…
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
        action-label="Open GA4 detail"
      />
    </div>
  </div>
</template>
