<script setup lang="ts">
import type { GscDimension, StatCardConfig } from '~/types/analytics'
import type { DatePreset } from '~/composables/useAnalyticsDateRange'

const route = useRoute()
const appName = computed(() => (route.params.app as string) ?? '')

useSeo({
  title: `${appName.value} — Analytics`,
  description: `Analytics deep dive for ${appName.value}: GA4, GSC, PostHog, IndexNow.`,
})
useWebPageSchema({
  name: 'App Analytics Deep Dive',
  description: 'Single-app analytics with KPIs, traffic chart, and breakdowns.',
})

const { apps: fleetApps, getAppStatus } = useFleet()
const appUrl = computed(() => fleetApps.value?.find((a) => a.name === appName.value)?.url ?? '')
const status = computed(() => getAppStatus(appName.value))

const { preset, startDate, endDate, presetOptions, presetLabel, setPreset } =
  useAnalyticsDateRange('7d')
const force = ref(false)

// ── Data fetching (all auto-cached via getCachedData in composables) ──
const {
  data: gaData,
  error: gaError,
  loading: gaLoading,
  load: loadGA,
} = useFleetGA(appName, startDate, endDate, force)

const gscParamsQuery = computed(() => ({
  startDate: startDate.value,
  endDate: endDate.value,
  dimension: 'query' as GscDimension,
  force: force.value,
}))
const { data: gscQueryData, load: loadGscQuery } = useFleetGscQuery(appName, gscParamsQuery)

const gscParamsDevice = computed(() => ({
  startDate: startDate.value,
  endDate: endDate.value,
  dimension: 'device' as GscDimension,
  force: force.value,
}))
const { data: gscDeviceData, load: loadGscDevice } = useFleetGscQuery(appName, gscParamsDevice)

const {
  data: posthogData,
  error: posthogError,
  loading: posthogLoading,
  load: loadPosthog,
} = useFleetPosthog(appName, startDate, endDate, force)

// ── Auto-load on mount and date changes ──
async function loadAll() {
  if (!appName.value) return
  await Promise.all([loadGA(), loadGscQuery(), loadGscDevice(), loadPosthog()])
}

watch([appName, startDate, endDate], () => loadAll(), { immediate: true })

async function onForceRefresh() {
  force.value = true
  try {
    await loadAll()
  } finally {
    force.value = false
  }
}

// ── Computed data (typed via centralized types) ──
const gaSummary = computed(() => {
  const s = gaData.value?.summary
  if (!s) return null
  return {
    users: s.activeUsers ?? 0,
    newUsers: s.newUsers ?? 0,
    sessions: s.sessions ?? 0,
    pageviews: s.screenPageViews ?? 0,
    bounceRate: s.bounceRate ?? 0,
    avgSessionDuration: s.averageSessionDuration ?? 0,
    engagementRate: s.engagementRate ?? 0,
    eventCount: s.eventCount ?? 0,
  }
})
const gaDeltas = computed(() => gaData.value?.deltas ?? null)
const gaTimeSeries = computed(() => gaData.value?.timeSeries ?? [])
const gscTotals = computed(() => gscQueryData.value?.totals ?? null)
const gscInspection = computed(() => gscQueryData.value?.inspection ?? null)
const gscTopQueries = computed(() => (gscQueryData.value?.rows ?? []).slice(0, 10))
const gscTopDevices = computed(() => (gscDeviceData.value?.rows ?? []).slice(0, 5))
const displayUrl = computed(() => appUrl.value.replace(/^https?:\/\//, ''))
const anyLoading = computed(() => gaLoading.value || posthogLoading.value)

// ── KPI stat cards (data-driven, no duplicated markup) ──
const gaKpis = computed<StatCardConfig[]>(() => {
  const s = gaSummary.value
  const d = gaDeltas.value
  if (!s) return []
  return [
    { label: 'Users', value: s.users, delta: d?.users, format: 'number' },
    { label: 'Sessions', value: s.sessions, delta: d?.sessions, format: 'number' },
    { label: 'Pageviews', value: s.pageviews, delta: d?.pageviews, format: 'number' },
    {
      label: 'Bounce Rate',
      value: s.bounceRate,
      delta: d?.bounceRate,
      format: 'percent',
      invertDelta: true,
    },
    {
      label: 'Avg Session',
      value: s.avgSessionDuration,
      delta: d?.avgSessionDuration,
      format: 'duration',
    },
    { label: 'Engagement', value: s.engagementRate, format: 'percent' },
  ]
})

const gscKpis = computed<StatCardConfig[]>(() => {
  const t = gscTotals.value
  if (!t) return []
  return [
    { label: 'GSC Clicks', value: t.clicks, format: 'number' },
    { label: 'Impressions', value: t.impressions, format: 'number' },
    { label: 'CTR', value: t.ctr, format: 'percent' },
    { label: 'Avg Position', value: t.position, format: 'number' },
  ]
})

const breadcrumbItems = computed(() => [
  { label: 'Dashboard', to: '/' },
  { label: 'Analytics', to: '/analytics' },
  { label: appName.value },
])
</script>

<template>
  <div class="space-y-6 overflow-hidden">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <!-- Header -->
    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div class="min-w-0">
        <h1 class="font-display text-2xl font-semibold text-default truncate">{{ appName }}</h1>
        <div class="mt-1 flex flex-wrap items-center gap-3 text-sm">
          <UButton
            v-if="appUrl"
            :to="appUrl"
            target="_blank"
            variant="link"
            color="primary"
            size="xs"
            class="cursor-pointer p-0"
            icon="i-lucide-external-link"
          >
            {{ displayUrl }}
          </UButton>
          <UBadge
            v-if="status"
            :color="status.status === 'up' ? 'success' : 'error'"
            variant="subtle"
            size="xs"
          >
            {{ status.status }}
          </UBadge>
        </div>
      </div>

      <!-- Date bar + Refresh -->
      <div class="w-full md:w-auto min-w-0">
        <AnalyticsDateBar
          :preset-options="presetOptions"
          :active-preset="preset"
          :loading="anyLoading"
          show-refresh
          v-model:start-date="startDate"
          v-model:end-date="endDate"
          @preset="setPreset($event as DatePreset)"
          @refresh="onForceRefresh"
        />
      </div>
    </div>

    <!-- GA4 KPI Grid -->
    <div
      v-if="gaLoading && !gaSummary"
      class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
    >
      <div
        v-for="i in 6"
        :key="i"
        class="h-20 sm:h-24 rounded-xl border border-default bg-elevated/30 animate-pulse"
      />
    </div>
    <div v-else-if="gaKpis.length" class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      <AnalyticsStatCard
        v-for="kpi in gaKpis"
        :key="kpi.label"
        v-bind="kpi"
        :loading="gaLoading"
        compact
      />
    </div>

    <!-- Traffic Chart -->
    <UCard v-if="gaTimeSeries.length">
      <template #header>
        <h2 class="text-sm font-medium text-default">Traffic ({{ presetLabel }})</h2>
      </template>
      <AnalyticsLineChart
        :data="gaTimeSeries"
        :title="`Pageviews — ${gaData?.startDate ?? ''} to ${gaData?.endDate ?? ''}`"
      />
    </UCard>

    <!-- GSC KPI Strip -->
    <div v-if="gscKpis.length" class="grid gap-3 grid-cols-2 sm:grid-cols-4">
      <AnalyticsStatCard v-for="kpi in gscKpis" :key="kpi.label" v-bind="kpi" compact />
    </div>

    <!-- Data Breakdowns -->
    <div class="grid gap-4 md:grid-cols-2">
      <FleetTopDimensionCard
        title="Top Pages"
        icon="i-lucide-file-text"
        :items="posthogData?.topPages ?? []"
      />
      <AnalyticsGscTopQueries :queries="gscTopQueries" :devices="gscTopDevices" />
      <FleetTopDimensionCard
        title="Top Referrers"
        icon="i-lucide-external-link"
        :items="posthogData?.topReferrers ?? []"
      />
      <FleetTopDimensionCard
        title="Top Countries"
        icon="i-lucide-globe"
        :items="posthogData?.topCountries ?? []"
      />
      <FleetTopDimensionCard
        title="Top Browsers"
        icon="i-lucide-laptop"
        :items="posthogData?.topBrowsers ?? []"
      />
    </div>

    <!-- URL Inspection -->
    <AnalyticsGscInspection v-if="gscInspection?.indexStatusResult" :inspection="gscInspection" />

    <!-- Sitemap -->
    <AnalyticsSitemapPanel :app-name="appName" />

    <!-- Quick Actions -->
    <AnalyticsQuickActions
      :app-name="appName"
      :replays-url="posthogData?.replaysUrl"
      :inspection-link="gscInspection?.inspectionResultLink"
    />

    <!-- Errors -->
    <AnalyticsErrorAlert
      v-if="gaError"
      provider="Google Analytics"
      :error="gaError"
      @retry="onForceRefresh"
    />
    <AnalyticsErrorAlert
      v-if="posthogError"
      provider="PostHog"
      :error="posthogError"
      @retry="onForceRefresh"
    />
  </div>
</template>
