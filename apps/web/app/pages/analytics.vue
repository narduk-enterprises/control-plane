<script setup lang="ts">
import type { FleetAppAnalyticsSummary } from '~/composables/useFleetAnalyticsSummary'

useSeo({
  title: 'Analytics Dashboard',
  description: 'Fleet-wide analytics: GA, GSC, and PostHog across all properties.',
})
useWebPageSchema({
  name: 'Analytics Dashboard',
  description: 'Fleet-wide analytics command center.',
})

const { apps: fleetApps, getAppStatus, refreshStatusesRaw } = useFleet()
const { data: indexnowSummary } = useFleetIndexnowSummary()

const dateState = useAnalyticsDateRange('30d')
const presetRef = dateState.preset
const startRef = dateState.startDate
const endRef = dateState.endDate

const forceFlag = ref(false)
const {
  data: summaryData,
  meta: summaryMeta,
  loading: summaryLoading,
  error: summaryError,
  load: loadSummary,
} = useFleetAnalyticsSummary(startRef, endRef, { force: forceFlag })
const {
  insights,
  loading: insightsLoading,
  error: insightsError,
  load: loadInsights,
} = useFleetAnalyticsInsights(startRef, endRef, { force: forceFlag })

const viewMode = ref<'cards' | 'dense'>('cards')

watch(viewMode, (v) => {
  try {
    if (import.meta.client && typeof localStorage !== 'undefined')
      localStorage.setItem('analytics-view-mode', v)
  } catch (_) {
    /* localStorage may be unavailable */
  }
})

const sortKey = ref('name')
const sortDir = ref<'asc' | 'desc'>('asc')
const statusFilter = ref<'all' | 'up' | 'down'>('all')

const normalizedSummary = computed(() => {
  const r = summaryData.value
  if (!r?.apps) return {}
  return r.apps as Record<string, FleetAppAnalyticsSummary>
})

const filteredApps = computed(() => {
  let list = fleetApps.value
  if (statusFilter.value !== 'all') {
    list = list.filter((app) => {
      const s = getAppStatus(app.name)
      return s?.status === statusFilter.value
    })
  }
  return list
})

const statusMapComputed = computed(() => {
  const m = new Map<string, import('~/types/fleet').FleetAppStatusRecord>()
  for (const app of filteredApps.value) {
    const s = getAppStatus(app.name)
    if (s) m.set(app.name, s)
  }
  return m
})

const freshness = computed(() => {
  const m = summaryMeta.value
  if (!m?.cachedAt) return null
  const at = new Date(m.cachedAt)
  const min = Math.round((Date.now() - at.getTime()) / 60_000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min} min ago`
  return at.toLocaleTimeString()
})

const is1hRef = dateState.is1h

async function loadAll(force = false) {
  if (is1hRef.value) return
  forceFlag.value = force
  try {
    await Promise.all([loadSummary(), loadInsights()])
  } finally {
    if (force) forceFlag.value = false
  }
}

async function refreshAll() {
  await loadAll(true)
}

// Auto-load on date changes
watch([startRef, endRef], () => loadAll(), { immediate: false })

onMounted(() => {
  try {
    const saved = localStorage.getItem('analytics-view-mode') as 'cards' | 'dense' | null
    if (saved === 'cards' || saved === 'dense') viewMode.value = saved
  } catch (_) {
    /* localStorage may be unavailable */
  }
  refreshStatusesRaw()
  if (!is1hRef.value) loadAll()
})

const breadcrumbItems = computed(() => [{ label: 'Dashboard', to: '/' }, { label: 'Analytics' }])

const summaryOrInsightsError = computed(() => (summaryError.value || insightsError.value) ?? null)
</script>

<template>
  <div class="pb-12 overflow-hidden">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="font-display text-2xl font-semibold text-default flex items-center gap-2">
          <UIcon name="i-lucide-activity" class="size-6 text-primary" />
          Analytics Dashboard
        </h1>
        <p class="mt-1 text-sm text-muted">
          Fleet-wide view: compare pageviews, clicks, and events across all properties.
        </p>
      </div>

      <div class="flex flex-col gap-2 min-w-0 w-full md:w-auto">
        <AnalyticsDateBar
          :preset-options="dateState.presetOptions"
          :active-preset="presetRef"
          :loading="summaryLoading"
          :freshness="freshness"
          show-refresh
          v-model:start-date="startRef"
          v-model:end-date="endRef"
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
      v-if="is1hRef"
      icon="i-lucide-info"
      title="Hourly filtering"
      description="Fleet summary is not available for Last Hour (GA/GSC use daily granularity). Choose a longer range."
      color="info"
      variant="subtle"
      class="mb-6"
    />

    <AnalyticsErrorAlert
      v-if="summaryError || insightsError"
      :provider="summaryError ? 'Analytics Summary' : 'Insights'"
      :error="summaryOrInsightsError"
      @retry="refreshAll"
    />

    <template v-if="!is1hRef">
      <!-- Config Health / Data Validation -->
      <AnalyticsConfigHealth
        :apps="fleetApps"
        :summary-map="normalizedSummary"
        :loading="summaryLoading"
      />

      <AnalyticsInsightsPanel :insights="insights" :loading="insightsLoading" />
      <AnalyticsFleetBanner :apps="normalizedSummary" :loading="summaryLoading" />

      <p v-if="indexnowSummary" class="mb-4 text-xs text-muted">
        IndexNow: {{ indexnowSummary.totalSubmissions?.toLocaleString() ?? 0 }} pings,
        {{ indexnowSummary.appsWithIndexnow ?? 0 }}/{{ indexnowSummary.totalFleetSize ?? 0 }} apps
      </p>

      <div class="mb-4 flex flex-wrap items-center gap-2">
        <span class="text-sm text-muted">Filter:</span>
        <UButton
          v-for="f in ['all', 'up', 'down'] as const"
          :key="f"
          size="xs"
          :color="statusFilter === f ? 'primary' : 'neutral'"
          variant="outline"
          @click="statusFilter = f"
        >
          {{ f === 'all' ? 'All' : f === 'up' ? 'Up' : 'Down' }}
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
          :data="normalizedSummary[app.name] ?? null"
          :status="getAppStatus(app.name)"
          :loading="summaryLoading"
        />
      </div>
      <AnalyticsFleetTable
        v-else
        :apps="filteredApps"
        :summary-map="normalizedSummary"
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
