<script setup lang="ts">
import type { StatCardConfig } from '~/types/analytics'

const route = useRoute()
const appName = computed(() => String(route.params.app ?? ''))

const {
  preset,
  startDate,
  endDate,
  dateState,
  snapshot,
  detailLoading,
  detailError,
  detailRevalidating,
  refreshDetail,
} = useAnalyticsAppDetail(appName)

const dateBarLoading = computed(() => detailLoading.value || detailRevalidating.value)

useSeo({
  title: `${appName.value} — Analytics`,
  description: `Canonical analytics snapshot for ${appName.value}.`,
})
useWebPageSchema({
  name: 'App Analytics Snapshot',
  description: 'Single-app analytics view with provider health and drilldowns.',
})

const gaSummary = computed(() => snapshot.value?.ga.metrics?.summary ?? null)
const gaDeltas = computed(() => snapshot.value?.ga.metrics?.deltas ?? null)
const gaTimeSeries = computed(() => snapshot.value?.ga.metrics?.timeSeries ?? [])
const gscMetrics = computed(() => snapshot.value?.gsc.metrics ?? null)
const posthogMetrics = computed(() => snapshot.value?.posthog.metrics ?? null)

const providerBadges = computed(() => {
  if (!snapshot.value) return []
  return [
    { label: 'GA4', status: snapshot.value.ga.status, message: snapshot.value.ga.message },
    { label: 'GSC', status: snapshot.value.gsc.status, message: snapshot.value.gsc.message },
    {
      label: 'PostHog',
      status: snapshot.value.posthog.status,
      message: snapshot.value.posthog.message,
    },
    {
      label: 'IndexNow',
      status: snapshot.value.indexnow.status,
      message: snapshot.value.indexnow.message,
    },
  ]
})

function badgeColor(status: string) {
  switch (status) {
    case 'healthy':
      return 'success'
    case 'stale':
      return 'warning'
    case 'missing_registry':
    case 'missing_config':
    case 'access_denied':
    case 'error':
      return 'error'
    default:
      return 'neutral'
  }
}

const gaCards = computed<StatCardConfig[]>(() => {
  if (!gaSummary.value) return []
  return [
    {
      label: 'Users',
      value: gaSummary.value.activeUsers,
      delta: gaDeltas.value?.users,
      format: 'number',
    },
    {
      label: 'Sessions',
      value: gaSummary.value.sessions,
      delta: gaDeltas.value?.sessions,
      format: 'number',
    },
    {
      label: 'Pageviews',
      value: gaSummary.value.screenPageViews,
      delta: gaDeltas.value?.pageviews,
      format: 'number',
    },
    { label: 'Engagement', value: gaSummary.value.engagementRate, format: 'percent' },
  ]
})

const gscCards = computed<StatCardConfig[]>(() => {
  if (!gscMetrics.value?.totals) return []
  return [
    { label: 'Clicks', value: gscMetrics.value.totals.clicks, format: 'number' },
    { label: 'Impressions', value: gscMetrics.value.totals.impressions, format: 'number' },
    { label: 'CTR', value: gscMetrics.value.totals.ctr, format: 'percent' },
    { label: 'Avg Position', value: gscMetrics.value.totals.position, format: 'number' },
  ]
})

const posthogCards = computed<StatCardConfig[]>(() => {
  if (!posthogMetrics.value) return []
  return [
    {
      label: 'Events',
      value: Number(posthogMetrics.value.summary.event_count ?? 0),
      format: 'number',
    },
    {
      label: 'Unique Users',
      value: Number(posthogMetrics.value.summary.unique_users ?? 0),
      format: 'number',
    },
    {
      label: 'Pageviews',
      value: Number(posthogMetrics.value.summary.pageviews ?? 0),
      format: 'number',
    },
    {
      label: 'Sessions',
      value: Number(posthogMetrics.value.summary.sessions ?? 0),
      format: 'number',
    },
  ]
})

const gscClickSeries = computed(() =>
  (gscMetrics.value?.timeSeries ?? []).map((point) => ({ date: point.date, value: point.clicks })),
)

const breadcrumbItems = computed(() => [
  { label: 'Dashboard', to: '/' },
  { label: 'Analytics', to: '/analytics' },
  { label: appName.value },
])
</script>

<template>
  <div class="space-y-6 overflow-hidden">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div class="min-w-0">
        <h1 class="truncate font-display text-2xl font-semibold text-default">{{ appName }}</h1>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <UBadge
            v-if="snapshot"
            :color="
              snapshot.health.status === 'up'
                ? 'success'
                : snapshot.health.status === 'down'
                  ? 'error'
                  : 'neutral'
            "
            variant="subtle"
            size="sm"
          >
            {{ snapshot.health.status }}
          </UBadge>
          <UBadge
            v-for="provider in providerBadges"
            :key="provider.label"
            :color="badgeColor(provider.status)"
            variant="soft"
            size="sm"
          >
            {{ provider.label }}
          </UBadge>
          <UBadge v-if="detailRevalidating" color="primary" variant="subtle" size="sm">
            Updating…
          </UBadge>
        </div>
      </div>

      <AnalyticsDateBar
        :preset-options="dateState.presetOptions"
        :active-preset="preset"
        :loading="dateBarLoading"
        show-refresh
        v-model:start-date="startDate"
        v-model:end-date="endDate"
        @preset="dateState.setPreset($event)"
        @refresh="refreshDetail"
      />
    </div>

    <AnalyticsErrorAlert
      v-if="detailError"
      provider="App snapshot"
      :error="detailError"
      @retry="refreshDetail"
    />

    <div v-if="snapshot" class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <UCard v-for="provider in providerBadges" :key="`${provider.label}-card`" class="rounded-2xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-[0.12em] text-muted">{{ provider.label }}</p>
            <p class="mt-1 text-base font-semibold text-default">{{ provider.status }}</p>
            <p class="mt-2 text-sm text-muted">{{ provider.message || 'Snapshot is healthy.' }}</p>
          </div>
          <UBadge :color="badgeColor(provider.status)" variant="soft" size="sm">
            {{ provider.status }}
          </UBadge>
        </div>
      </UCard>
    </div>

    <div v-if="gaCards.length" class="grid gap-3 grid-cols-2 sm:grid-cols-4">
      <AnalyticsStatCard v-for="card in gaCards" :key="card.label" v-bind="card" compact />
    </div>

    <UCard v-if="gaTimeSeries.length">
      <template #header>
        <h2 class="text-sm font-medium text-default">GA4 Pageviews</h2>
      </template>
      <AnalyticsLineChart :data="gaTimeSeries" :title="`${startDate} to ${endDate}`" />
    </UCard>

    <div v-if="gscCards.length" id="search-console" class="grid gap-3 grid-cols-2 sm:grid-cols-4">
      <AnalyticsStatCard v-for="card in gscCards" :key="card.label" v-bind="card" compact />
    </div>

    <UCard v-if="gscClickSeries.length">
      <template #header>
        <h2 class="text-sm font-medium text-default">Search Console Clicks</h2>
      </template>
      <AnalyticsLineChart :data="gscClickSeries" :title="`${startDate} to ${endDate}`" />
    </UCard>

    <AnalyticsGscTopQueries
      v-if="gscMetrics"
      :queries="gscMetrics.queries.slice(0, 10)"
      :devices="gscMetrics.devices.slice(0, 5)"
    />

    <AnalyticsGscInspection
      v-if="gscMetrics?.inspection?.indexStatusResult"
      :inspection="gscMetrics.inspection"
    />

    <div v-if="posthogCards.length" class="grid gap-3 grid-cols-2 sm:grid-cols-4">
      <AnalyticsStatCard
        v-for="card in posthogCards"
        :key="`ph-${card.label}`"
        v-bind="card"
        compact
      />
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <FleetTopDimensionCard
        title="Top Pages"
        icon="i-lucide-file-text"
        :items="posthogMetrics?.topPages ?? []"
      />
      <FleetTopDimensionCard
        title="Top Referrers"
        icon="i-lucide-arrow-up-right"
        :items="posthogMetrics?.topReferrers ?? []"
      />
      <FleetTopDimensionCard
        title="Top Countries"
        icon="i-lucide-globe"
        :items="posthogMetrics?.topCountries ?? []"
      />
      <FleetTopDimensionCard
        title="Top Browsers"
        icon="i-lucide-monitor"
        :items="posthogMetrics?.topBrowsers ?? []"
      />
    </div>

    <AnalyticsSitemapPanel :app-name="appName" />

    <AnalyticsQuickActions
      :app-name="appName"
      :replays-url="posthogMetrics?.replaysUrl ?? undefined"
      :inspection-link="gscMetrics?.inspection?.inspectionResultLink"
    />
  </div>
</template>
