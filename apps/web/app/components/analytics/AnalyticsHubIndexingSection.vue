<script setup lang="ts">
import type { FleetRegistryApp } from '~/types/fleet'
import {
  DEFAULT_CLIENT_CACHE_MAX_AGE_MS,
  getNuxtCachedData,
  markNuxtFetchedAt,
} from '~/utils/fetchCache'

const props = defineProps<{
  apps: FleetRegistryApp[]
}>()

const activeTab = ref<'indexnow' | 'gsc-sitemaps'>('indexnow')
const nuxtApp = useNuxtApp()
const toast = useToast()

const {
  data: indexnowSummary,
  pending: indexnowSummaryPending,
  refresh: refreshIndexnowSummary,
} = useLazyFetch<{
  totalSubmissions: number
  appsWithIndexnow: number
  totalFleetSize: number
}>('/api/fleet/indexnow/summary', {
  key: 'fleet-indexnow-summary',
  server: false,
  immediate: false,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
  getCachedData(key, nuxtApp) {
    return getNuxtCachedData(key, nuxtApp, DEFAULT_CLIENT_CACHE_MAX_AGE_MS)
  },
  transform(input) {
    markNuxtFetchedAt(nuxtApp, 'fleet-indexnow-summary')
    return input
  },
})

const {
  data: gscSitemapSummary,
  pending: gscSitemapSummaryPending,
  refresh: refreshGscSitemapSummary,
} = useLazyFetch<{
  totalSubmissions: number
  appsWithSubmission: number
  totalFleetSize: number
}>('/api/fleet/gsc-sitemap/summary', {
  key: 'fleet-gsc-sitemap-summary',
  server: false,
  immediate: false,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
  getCachedData(key, nuxtApp) {
    return getNuxtCachedData(key, nuxtApp, DEFAULT_CLIENT_CACHE_MAX_AGE_MS)
  },
  transform(input) {
    markNuxtFetchedAt(nuxtApp, 'fleet-gsc-sitemap-summary')
    return input
  },
})

const { submitting: indexnowSubmitting, submitAll: submitAllIndexnow } = useBatchIndexnow(
  computed(() => props.apps),
)
const { submitting: gscSitemapSubmitting, submitAll: submitAllGscSitemap } = useBatchGscSitemap(
  computed(() => props.apps),
)

const indexnowHistoryRefreshKey = ref(0)
const gscSitemapHistoryRefreshKey = ref(0)

const tabOptions = [
  {
    value: 'indexnow',
    label: 'IndexNow',
    icon: 'i-lucide-send',
    description: 'Bulk pings and history for IndexNow submissions from the control plane.',
  },
  {
    value: 'gsc-sitemaps',
    label: 'GSC Sitemaps',
    icon: 'i-lucide-map',
    description: 'Search Console sitemap registrations and their submission log.',
  },
]

watch(
  activeTab,
  (tab) => {
    if (tab === 'indexnow') {
      if (!indexnowSummary.value) {
        void refreshIndexnowSummary()
      }
      return
    }

    if (!gscSitemapSummary.value) {
      void refreshGscSitemapSummary()
    }
  },
  { immediate: true },
)

async function onBatchIndexnow() {
  const { ok, fail } = await submitAllIndexnow()
  indexnowHistoryRefreshKey.value += 1
  await refreshIndexnowSummary()
  toast.add({
    title: 'IndexNow',
    description:
      fail === 0
        ? `Pinged ${ok} app(s); summary updated.`
        : `Succeeded: ${ok}. Failed: ${fail} (check app INDEXNOW_KEY / deploy).`,
    color: fail === 0 ? 'success' : 'warning',
  })
}

async function onBatchGscSitemap() {
  const { ok, fail } = await submitAllGscSitemap()
  gscSitemapHistoryRefreshKey.value += 1
  await refreshGscSitemapSummary()
  toast.add({
    title: 'GSC sitemaps',
    description:
      fail === 0
        ? `Submitted ${ok} app(s); summary updated.`
        : `Succeeded: ${ok}. Failed: ${fail} (GSC scope, property access, or sitemap URL).`,
    color: fail === 0 ? 'success' : 'warning',
  })
}
</script>

<template>
  <div class="space-y-4">
    <AnalyticsSectionTabs v-model="activeTab" :items="tabOptions" />

    <div
      v-if="activeTab === 'indexnow' && indexnowSummaryPending && !indexnowSummary"
      class="rounded-2xl border border-dashed border-default bg-elevated/20 px-5 py-8 text-center text-sm text-muted"
    >
      Loading IndexNow workspace…
    </div>
    <KeepAlive>
      <AnalyticsHubIndexnowSection
        v-if="activeTab === 'indexnow' && (!indexnowSummaryPending || indexnowSummary)"
        :indexnow-summary="indexnowSummary ?? null"
        :indexnow-submitting="indexnowSubmitting"
        :history-refresh-key="indexnowHistoryRefreshKey"
        @batch-submit="onBatchIndexnow"
      />
    </KeepAlive>

    <div
      v-if="activeTab === 'gsc-sitemaps' && gscSitemapSummaryPending && !gscSitemapSummary"
      class="rounded-2xl border border-dashed border-default bg-elevated/20 px-5 py-8 text-center text-sm text-muted"
    >
      Loading GSC sitemap workspace…
    </div>
    <KeepAlive>
      <AnalyticsHubGscSitemapSection
        v-if="activeTab === 'gsc-sitemaps' && (!gscSitemapSummaryPending || gscSitemapSummary)"
        :gsc-sitemap-summary="gscSitemapSummary ?? null"
        :gsc-sitemap-submitting="gscSitemapSubmitting"
        :history-refresh-key="gscSitemapHistoryRefreshKey"
        @batch-submit="onBatchGscSitemap"
      />
    </KeepAlive>
  </div>
</template>
