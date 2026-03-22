<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAnalyticsStore } from '~/stores/analytics'

useSeo({
  title: 'Analytics Dashboard',
  description: 'Fleet-wide analytics: GA4, Search Console, PostHog, and integration health.',
})
useWebPageSchema({
  name: 'Analytics Dashboard',
  description: 'Fleet-wide analytics command center.',
})

const analyticsStore = useAnalyticsStore()
const { preset, startDate, endDate } = storeToRefs(analyticsStore)
const dateState = useAnalyticsDateRange('30d')

const { apps: fleetApps, getAppStatus, refreshStatusesRaw } = useFleet()

const { data: indexnowSummary, refresh: refreshIndexnowSummary } = useFleetIndexnowSummary()
const { submitting: indexnowSubmitting, submitAll: submitAllIndexnow } = useBatchIndexnow(fleetApps)

const viewMode = ref<'cards' | 'dense'>('cards')
const statusFilter = ref<'all' | 'up' | 'down'>('all')
const sortKey = ref('name')
const sortDir = ref<'asc' | 'desc'>('asc')

const range = computed(() => ({ startDate: startDate.value, endDate: endDate.value }))
const summary = computed(() => analyticsStore.getSummary(range.value))
const snapshotMap = computed(() => summary.value?.apps ?? {})
const summaryLoading = computed(() => analyticsStore.getSummaryStatus(range.value) === 'pending')
const summaryError = computed(() => analyticsStore.getSummaryError(range.value))
const insights = computed(() => analyticsStore.getInsights(range.value))

const freshness = computed(() => {
  const generatedAt = summary.value?.generatedAt
  if (!generatedAt) return null
  const diffMinutes = Math.round((Date.now() - new Date(generatedAt).getTime()) / 60_000)
  if (diffMinutes < 1) return 'Updated just now'
  if (diffMinutes < 60) return `Updated ${diffMinutes} min ago`
  return `Updated ${new Date(generatedAt).toLocaleTimeString()}`
})

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

async function loadSummary(force = false) {
  if (preset.value === '1h') return
  await analyticsStore.fetchSummary({ range: range.value, force })
}

async function refreshAll() {
  await Promise.all([loadSummary(true), refreshStatusesRaw()])
}

async function batchSubmitIndexnow() {
  await submitAllIndexnow()
  await refreshIndexnowSummary()
}

watch(range, () => {
  if (preset.value !== '1h') {
    void loadSummary()
  }
})

onMounted(() => {
  try {
    const saved = localStorage.getItem('analytics-view-mode') as 'cards' | 'dense' | null
    if (saved === 'cards' || saved === 'dense') viewMode.value = saved
  } catch {
    // Ignore localStorage issues.
  }

  void refreshStatusesRaw()
  void loadSummary()
})

watch(viewMode, (value) => {
  if (!import.meta.client) return
  try {
    localStorage.setItem('analytics-view-mode', value)
  } catch {
    // Ignore localStorage issues.
  }
})

const breadcrumbItems = computed(() => [{ label: 'Dashboard', to: '/' }, { label: 'Analytics' }])
</script>

<template>
  <div class="overflow-hidden pb-12">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="flex items-center gap-2 font-display text-2xl font-semibold text-default">
          <UIcon name="i-lucide-chart-column-big" class="size-6 text-primary" />
          Analytics
        </h1>
        <p class="mt-1 text-sm text-muted">
          Canonical fleet snapshot for GA4, Search Console, PostHog, and IndexNow.
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <AnalyticsDateBar
          :preset-options="dateState.presetOptions"
          :active-preset="preset"
          :loading="summaryLoading"
          :freshness="freshness"
          show-refresh
          v-model:start-date="startDate"
          v-model:end-date="endDate"
          @preset="dateState.setPreset($event)"
          @refresh="refreshAll"
        />

        <div class="flex items-center gap-2">
          <UButton
            :color="viewMode === 'cards' ? 'primary' : 'neutral'"
            variant="outline"
            size="xs"
            icon="i-lucide-layout-grid"
            class="cursor-pointer"
            @click="viewMode = 'cards'"
          >
            Cards
          </UButton>
          <UButton
            :color="viewMode === 'dense' ? 'primary' : 'neutral'"
            variant="outline"
            size="xs"
            icon="i-lucide-table"
            class="cursor-pointer"
            @click="viewMode = 'dense'"
          >
            Dense
          </UButton>
        </div>
      </div>
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
      <AnalyticsHealthPanel
        :apps="fleetApps"
        :snapshot-map="snapshotMap"
        :insights="insights"
        :loading="summaryLoading"
      />

      <AnalyticsFleetBanner :summary="summary" :loading="summaryLoading" />

      <div
        v-if="indexnowSummary"
        class="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-default/60 bg-elevated/30 px-4 py-3"
      >
        <div class="flex items-center gap-2 text-sm text-muted">
          <UIcon name="i-lucide-send" class="size-4 text-primary" />
          <span>IndexNow</span>
          <UBadge
            variant="subtle"
            size="sm"
            :color="(indexnowSummary.appsWithIndexnow ?? 0) > 0 ? 'success' : 'neutral'"
          >
            {{ indexnowSummary.appsWithIndexnow ?? 0 }}/{{
              indexnowSummary.totalFleetSize ?? 0
            }}
            apps
          </UBadge>
          <span class="hidden sm:inline">
            {{ indexnowSummary.totalSubmissions?.toLocaleString() ?? 0 }} total pings
          </span>
        </div>
        <UButton
          size="xs"
          variant="soft"
          color="primary"
          icon="i-lucide-send"
          class="ml-auto cursor-pointer"
          :loading="indexnowSubmitting"
          @click="batchSubmitIndexnow"
        >
          Submit All
        </UButton>
      </div>

      <div class="mb-4 flex flex-wrap items-center gap-2">
        <span class="text-sm text-muted">Filter:</span>
        <UButton
          v-for="filterValue in ['all', 'up', 'down'] as const"
          :key="filterValue"
          size="xs"
          :color="statusFilter === filterValue ? 'primary' : 'neutral'"
          variant="outline"
          class="cursor-pointer"
          @click="statusFilter = filterValue"
        >
          {{ filterValue === 'all' ? 'All' : filterValue === 'up' ? 'Up' : 'Down' }}
        </UButton>
      </div>

      <div
        v-if="viewMode === 'cards'"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <AnalyticsFleetCard
          v-for="app in filteredApps"
          :key="app.name"
          :app-name="app.name"
          :app-url="app.url"
          :snapshot="snapshotMap[app.name] ?? null"
          :status="getAppStatus(app.name)"
          :loading="summaryLoading"
        />
      </div>

      <AnalyticsFleetTable
        v-else
        :apps="filteredApps"
        :snapshot-map="snapshotMap"
        :status-map="statusMapComputed"
        :loading="summaryLoading"
        :sort-key="sortKey"
        :sort-dir="sortDir"
        @update:sort-key="sortKey = $event"
        @update:sort-dir="sortDir = $event"
      />
    </template>
  </div>
</template>
