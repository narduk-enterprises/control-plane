<script setup lang="ts">
useSeo({
  title: 'Analytics Dashboard',
  description: 'Fleet-wide analytics: GA4, Search Console, PostHog, and integration health.',
})
useWebPageSchema({
  name: 'Analytics Dashboard',
  description: 'Fleet-wide analytics command center.',
})

const {
  preset,
  startDate,
  endDate,
  dateState,
  fleetApps,
  getAppStatus,
  indexnowSummary,
  indexnowSubmitting,
  summary,
  snapshotMap,
  summaryLoading,
  summaryError,
  insights,
  summaryRevalidating,
  serverStale,
  freshness,
  refreshAll,
  batchSubmitIndexnow,
} = useAnalyticsHub()

const activeTab = ref<'overview' | 'fleet' | 'indexnow'>('overview')
const statusFilter = ref<'all' | 'up' | 'down'>('all')
const sortKey = ref('name')
const sortDir = ref<'asc' | 'desc'>('asc')

const dateBarLoading = computed(() => summaryLoading.value || summaryRevalidating.value)

const filteredApps = computed(() => {
  let list = fleetApps.value
  if (statusFilter.value !== 'all') {
    list = list.filter((app) => getAppStatus(app.name)?.status === statusFilter.value)
  }
  return list
})

const statusMapComputed = computed(() => {
  const map = new Map()
  for (const app of filteredApps.value) {
    const status = getAppStatus(app.name)
    if (status) map.set(app.name, status)
  }
  return map
})

const breadcrumbItems = computed(() => [{ label: 'Dashboard', to: '/' }, { label: 'Analytics' }])

const tabs = [
  { id: 'overview' as const, label: 'Overview', icon: 'i-lucide-layout-dashboard' },
  { id: 'fleet' as const, label: 'Fleet', icon: 'i-lucide-grid-2x2' },
  { id: 'indexnow' as const, label: 'IndexNow', icon: 'i-lucide-send' },
]
</script>

<template>
  <div class="overflow-hidden pb-12">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 class="flex items-center gap-2 font-display text-2xl font-semibold text-default">
          <UIcon name="i-lucide-chart-column-big" class="size-6 text-primary" />
          Analytics Dashboard
        </h1>
        <p class="mt-1 text-sm text-muted">
          GA4, Search Console, PostHog, and IndexNow — cached in D1 with background refresh.
        </p>
        <div
          v-if="serverStale || summaryRevalidating"
          class="mt-2 flex flex-wrap items-center gap-2"
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

    <div class="mb-6 flex flex-wrap gap-1 border-b border-default pb-px">
      <UButton
        v-for="tab in tabs"
        :key="tab.id"
        size="sm"
        :color="activeTab === tab.id ? 'primary' : 'neutral'"
        :variant="activeTab === tab.id ? 'solid' : 'ghost'"
        :icon="tab.icon"
        class="cursor-pointer rounded-b-none"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </UButton>
    </div>

    <UAlert
      v-if="preset === '1h'"
      icon="i-lucide-info"
      title="Last hour is not supported"
      description="Fleet analytics snapshots use daily GA4 and Search Console granularity. Choose a longer range."
      color="info"
      variant="subtle"
      class="mb-6"
    />

    <AnalyticsErrorAlert
      v-if="summaryError"
      provider="Analytics Snapshot"
      :error="summaryError"
      @retry="refreshAll"
    />

    <template v-if="preset !== '1h'">
      <KeepAlive>
        <AnalyticsHubOverviewSection
          v-if="activeTab === 'overview'"
          key="analytics-tab-overview"
          :apps="fleetApps"
          :snapshot-map="snapshotMap"
          :insights="insights"
          :loading="summaryLoading"
          :summary="summary"
        />
        <AnalyticsHubFleetSection
          v-else-if="activeTab === 'fleet'"
          key="analytics-tab-fleet"
          v-model:status-filter="statusFilter"
          :apps="filteredApps"
          :snapshot-map="snapshotMap"
          :status-map="statusMapComputed"
          :loading="summaryLoading"
          :sort-key="sortKey"
          :sort-dir="sortDir"
          @update:sort-key="sortKey = $event"
          @update:sort-dir="sortDir = $event"
        />
        <AnalyticsHubIndexnowSection
          v-else-if="activeTab === 'indexnow'"
          key="analytics-tab-indexnow"
          :indexnow-summary="indexnowSummary ?? null"
          :indexnow-submitting="indexnowSubmitting"
          @batch-submit="batchSubmitIndexnow"
        />
      </KeepAlive>
    </template>
  </div>
</template>
