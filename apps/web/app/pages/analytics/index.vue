<script setup lang="ts">
import type { AnalyticsSurface } from '~/utils/analyticsPresentation'
import { ANALYTICS_SURFACE_OPTIONS, normalizeAnalyticsSurface } from '~/utils/analyticsPresentation'

const route = useRoute()
const router = useRouter()

useSeo({
  title: 'Analytics Dashboard',
  description: 'Fleet-wide analytics: GA4, Search Console, PostHog, and indexing operations.',
})
useWebPageSchema({
  name: 'Analytics Dashboard',
  description: 'Fleet-wide analytics command center.',
})

const currentSurface = computed<AnalyticsSurface>({
  get() {
    return normalizeAnalyticsSurface(typeof route.query.view === 'string' ? route.query.view : null)
  },
  set(value) {
    const query = { ...route.query }
    if (value === 'overview') {
      delete query.view
    } else {
      query.view = value
    }
    void router.replace({ query })
  },
})

const isDateBoundSurface = computed(() => currentSurface.value !== 'indexing')

const {
  preset,
  startDate,
  endDate,
  dateState,
  fleetApps,
  summary,
  snapshotMap,
  summaryLoading,
  summaryError,
  insights,
  summaryRevalidating,
  serverStale,
  freshness,
  refreshAll,
  refreshFleetHealth,
} = useAnalyticsHub({
  loadFleetSnapshots: computed(() => currentSurface.value !== 'indexing'),
  loadIntegrationHealth: computed(() => currentSurface.value === 'overview'),
})

const dateBarLoading = computed(() => summaryLoading.value || summaryRevalidating.value)
const surfaceBlocksSelectedRange = computed(
  () => currentSurface.value !== 'indexing' && preset.value === '1h',
)
const breadcrumbItems = computed(() => [{ label: 'Dashboard', to: '/' }, { label: 'Analytics' }])
</script>

<template>
  <div class="space-y-6 overflow-hidden pb-12">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-2">
        <h1 class="flex items-center gap-2 font-display text-2xl font-semibold text-default">
          <UIcon name="i-lucide-chart-column-big" class="size-6 text-primary" />
          Analytics Dashboard
        </h1>
        <p class="text-sm text-muted">
          Provider-first analytics surfaces with cached fleet snapshots and lazy indexing
          workspaces.
        </p>
        <div
          v-if="isDateBoundSurface && (serverStale || summaryRevalidating)"
          class="flex flex-wrap items-center gap-2"
        >
          <UBadge v-if="serverStale" color="warning" variant="subtle" size="sm">
            Serving cached snapshot; refreshing in background
          </UBadge>
          <UBadge v-if="summaryRevalidating" color="primary" variant="subtle" size="sm">
            Updating…
          </UBadge>
        </div>
      </div>

      <AnalyticsDateBar
        v-if="isDateBoundSurface"
        :preset-options="dateState.presetOptions"
        :active-preset="preset"
        :loading="dateBarLoading"
        :freshness="freshness"
        show-refresh
        v-model:start-date="startDate"
        v-model:end-date="endDate"
        @preset="dateState.setPreset($event)"
        @refresh="refreshAll"
      />
    </div>

    <AnalyticsSectionTabs v-model="currentSurface" :items="ANALYTICS_SURFACE_OPTIONS" />

    <UAlert
      v-if="surfaceBlocksSelectedRange"
      icon="i-lucide-info"
      title="Last hour is not supported for canonical analytics snapshots"
      description="Fleet analytics snapshots use daily GA4 and Search Console granularity. Switch to a longer range."
      color="info"
      variant="subtle"
    />

    <AnalyticsErrorAlert
      v-if="summaryError && currentSurface !== 'indexing'"
      provider="Analytics Snapshot"
      :error="summaryError"
      @retry="refreshAll"
    />

    <template v-if="!surfaceBlocksSelectedRange">
      <AnalyticsHubOverviewSection
        v-if="currentSurface === 'overview'"
        :apps="fleetApps"
        :snapshot-map="snapshotMap"
        :insights="insights"
        :loading="summaryLoading"
        :summary-revalidating="summaryRevalidating"
        :summary="summary"
        @refresh-fleet-health="refreshFleetHealth"
      />
      <AnalyticsGaFleetSection
        v-else-if="currentSurface === 'ga'"
        :apps="fleetApps"
        :snapshot-map="snapshotMap"
        :loading="summaryLoading"
      />
      <AnalyticsGscFleetSection
        v-else-if="currentSurface === 'gsc'"
        :apps="fleetApps"
        :snapshot-map="snapshotMap"
        :loading="summaryLoading"
      />
      <AnalyticsPosthogFleetSection
        v-else-if="currentSurface === 'posthog'"
        :apps="fleetApps"
        :snapshot-map="snapshotMap"
        :loading="summaryLoading"
      />
      <AnalyticsHubIndexingSection v-else :apps="fleetApps" />
    </template>
  </div>
</template>
