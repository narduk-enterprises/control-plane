<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
const optsRef = dateState.presetOptions
const setPresetFn = dateState.setPreset
const is1hRef = dateState.is1h

const forceFlag = ref(false)
const { data: summaryData, meta: summaryMeta, loading: summaryLoading, error: summaryError, load: loadSummary } = useFleetAnalyticsSummary(
  startRef,
  endRef,
  { force: forceFlag },
)
const { insights, loading: insightsLoading, error: insightsError, load: loadInsights } = useFleetAnalyticsInsights(startRef, endRef, { force: forceFlag })

const viewMode = ref<'cards' | 'dense'>('cards')

watch(viewMode, (v) => {
  try {
    if (import.meta.client && typeof localStorage !== 'undefined') localStorage.setItem('analytics-view-mode', v)
  } catch (_) { /* localStorage may be unavailable */ }
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

async function loadAll(force = false) {
  if (is1hRef.value) return
  forceFlag.value = force
  await nextTick()
  await Promise.all([loadSummary(), loadInsights()])
  if (force) forceFlag.value = false
}

async function refreshAll() {
  await loadAll(true)
}

watch([startRef, endRef], () => { loadAll() }, { immediate: false })

onMounted(() => {
  try {
    const saved = localStorage.getItem('analytics-view-mode') as 'cards' | 'dense' | null
    if (saved === 'cards' || saved === 'dense') viewMode.value = saved
  } catch (_) { /* localStorage may be unavailable */ }
  refreshStatusesRaw()
  if (!is1hRef.value) loadAll()
})

const breadcrumbItems = computed(() => [{ label: 'Dashboard', to: '/' }, { label: 'Analytics' }])
</script>

<template>
  <div class="pb-12">
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
      <div class="flex flex-wrap items-center gap-2">
        <ClientOnly>
          <UButton
            v-for="opt in optsRef"
            :key="opt.value"
            size="xs"
            :color="presetRef === opt.value ? 'primary' : 'neutral'"
            :variant="presetRef === opt.value ? 'solid' : 'outline'"
            class="cursor-pointer rounded-full"
            @click="setPresetFn(opt.value)"
          >
            {{ opt.label }}
          </UButton>
        </ClientOnly>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-refresh-cw"
          size="xs"
          class="cursor-pointer"
          :loading="summaryLoading"
          @click="refreshAll"
        >
          Refresh
        </UButton>
        <span v-if="freshness" class="text-xs text-muted">{{ freshness }}</span>
        <USeparator orientation="vertical" class="hidden sm:block h-6" />
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

    <div v-if="presetRef === 'custom'" class="mb-6 flex items-center gap-2 bg-elevated/50 p-2 rounded-lg w-fit border border-default">
      <UInput v-model="startRef" type="date" size="sm" />
      <span class="text-xs text-muted">to</span>
      <UInput v-model="endRef" type="date" size="sm" />
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

    <UAlert
      v-if="(summaryError || insightsError) && !summaryLoading && !insightsLoading"
      icon="i-lucide-alert-circle"
      title="Failed to load analytics"
      color="error"
      variant="subtle"
      class="mb-6"
      :description="summaryError?.message || insightsError?.message || 'Server timeout or error (502/522). Cache may still be warming from cron.'"
    >
      <template #actions>
        <UButton
          size="xs"
          color="error"
          variant="soft"
          class="cursor-pointer"
          @click="refreshAll"
        >
          Retry
        </UButton>
      </template>
    </UAlert>

    <template v-if="!is1hRef">
      <AnalyticsInsightsPanel
        :insights="insights"
        :loading="insightsLoading"
      />
      <AnalyticsFleetBanner
        :apps="normalizedSummary"
        :loading="summaryLoading"
      />
      <p v-if="indexnowSummary" class="mb-4 text-xs text-muted">
        IndexNow: {{ indexnowSummary.totalSubmissions?.toLocaleString() ?? 0 }} pings,
        {{ indexnowSummary.appsWithIndexnow ?? 0 }}/{{ indexnowSummary.totalFleetSize ?? 0 }} apps
      </p>

      <div class="mb-4 flex flex-wrap items-center gap-2">
        <span class="text-sm text-muted">Filter:</span>
        <UButton
          size="xs"
          :color="statusFilter === 'all' ? 'primary' : 'neutral'"
          variant="outline"
          @click="statusFilter = 'all'"
        >
          All
        </UButton>
        <UButton
          size="xs"
          :color="statusFilter === 'up' ? 'primary' : 'neutral'"
          variant="outline"
          @click="statusFilter = 'up'"
        >
          Up
        </UButton>
        <UButton
          size="xs"
          :color="statusFilter === 'down' ? 'primary' : 'neutral'"
          variant="outline"
          @click="statusFilter = 'down'"
        >
          Down
        </UButton>
      </div>

      <div v-if="viewMode === 'cards'" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
