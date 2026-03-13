<script setup lang="ts">
import type { GscDimension } from '~/composables/useFleetGscQuery'
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
const compareMode = ref(false)
const force = ref(false)

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
const {
  data: gscQueryData,
  loading: _gscQueryLoading,
  load: loadGscQuery,
} = useFleetGscQuery(appName, gscParamsQuery)

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
const {
  data: _indexnowData,
  loading: indexnowLoading,
  submit: submitIndexnow,
} = useFleetIndexnow(appName)
const {
  data: sitemapData,
  error: sitemapError,
  loading: sitemapLoading,
  run: runSitemapAnalysis,
} = useFleetSitemapAnalysis(appName)

function loadAll() {
  if (!appName.value) return
  loadGA()
  loadGscQuery()
  loadGscDevice()
  loadPosthog()
}

watch(
  [appName, startDate, endDate],
  () => {
    loadAll()
  },
  { immediate: true },
)

async function onForceRefresh() {
  force.value = true
  await loadAll()
  force.value = false
}

function onPresetChange(p: string) {
  setPreset(p as DatePreset)
}

const gaSummary = computed(() => {
  const d = gaData.value
  if (!d?.summary || typeof d.summary !== 'object') return null
  const s = d.summary as Record<string, unknown>
  return {
    users: Number(s.activeUsers ?? 0),
    newUsers: Number(s.newUsers ?? 0),
    sessions: Number(s.sessions ?? 0),
    pageviews: Number(s.screenPageViews ?? 0),
    bounceRate: Number(s.bounceRate ?? 0),
    avgSessionDuration: Number(s.averageSessionDuration ?? 0),
    engagementRate: Number(s.engagementRate ?? 0),
    eventCount: Number(s.eventCount ?? 0),
  }
})
const gaDeltas = computed(
  () => (gaData.value as { deltas?: Record<string, number> } | null)?.deltas ?? null,
)
const gaTimeSeries = computed(() => gaData.value?.timeSeries ?? [])

const gscTotals = computed(() => gscQueryData.value?.totals ?? null)
const gscInspection = computed(() => gscQueryData.value?.inspection ?? null)
const formattedLastCrawlTime = computed(() => {
  const t = gscInspection.value?.indexStatusResult?.lastCrawlTime
  if (!t) return null
  try {
    return new Date(t).toLocaleString()
  } catch {
    return t
  }
})
const formattedCrawledAs = computed(() => gscInspection.value?.indexStatusResult?.crawledAs ?? null)

const breadcrumbItems = computed(() => [
  { label: 'Dashboard', to: '/' },
  { label: 'Analytics', to: '/analytics' },
  { label: appName.value },
])

const gscTopQueries = computed(() => (gscQueryData.value?.rows ?? []).slice(0, 10))
const gscTopDevices = computed(() => (gscDeviceData.value?.rows ?? []).slice(0, 5))
const sitemapUrlsPreview = computed(() => (sitemapData.value?.urls ?? []).slice(0, 50))
const displayUrl = computed(() => appUrl.value.replace(/^https?:\/\//, ''))
</script>

<template>
  <div class="space-y-6">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="font-display text-2xl font-semibold text-default">
          {{ appName }}
        </h1>
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
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex gap-1 rounded-lg border border-default p-1 shadow-xs">
          <UButton
            v-for="opt in presetOptions"
            :key="opt.value"
            size="xs"
            :color="preset === opt.value ? 'primary' : 'neutral'"
            :variant="preset === opt.value ? 'solid' : 'outline'"
            class="cursor-pointer"
            @click="onPresetChange(opt.value)"
          >
            {{ opt.label }}
          </UButton>
        </div>
        <UButton
          size="xs"
          variant="ghost"
          :color="compareMode ? 'primary' : 'neutral'"
          icon="i-lucide-git-compare"
          class="cursor-pointer"
          @click="compareMode = !compareMode"
        >
          Compare
        </UButton>
        <UButton
          size="xs"
          variant="ghost"
          :icon="gaLoading || posthogLoading ? 'i-lucide-loader-2' : 'i-lucide-refresh-cw'"
          :class="gaLoading || posthogLoading ? 'animate-spin' : ''"
          class="cursor-pointer text-muted hover:text-default"
          @click="onForceRefresh"
        >
          Refresh
        </UButton>
      </div>
    </div>

    <!-- KPI Row -->
    <div
      v-if="gaLoading && !gaSummary"
      class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6"
    >
      <div
        v-for="i in 6"
        :key="i"
        class="h-24 rounded-xl border border-default bg-elevated/30 animate-pulse"
      />
    </div>
    <div v-else-if="gaSummary" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      <div class="rounded-xl border border-default bg-elevated/30 p-4">
        <p class="text-sm font-medium text-muted">Users</p>
        <p class="mt-1 text-xl font-semibold text-default">
          {{ gaSummary.users.toLocaleString() }}
        </p>
        <p
          v-if="gaDeltas?.users !== undefined"
          class="mt-0.5 text-xs"
          :class="gaDeltas.users >= 0 ? 'text-success' : 'text-error'"
        >
          {{ gaDeltas.users >= 0 ? '+' : '' }}{{ gaDeltas.users.toFixed(1) }}% vs prev
        </p>
      </div>
      <div class="rounded-xl border border-default bg-elevated/30 p-4">
        <p class="text-sm font-medium text-muted">Sessions</p>
        <p class="mt-1 text-xl font-semibold text-default">
          {{ gaSummary.sessions.toLocaleString() }}
        </p>
        <p
          v-if="gaDeltas?.sessions !== undefined"
          class="mt-0.5 text-xs"
          :class="gaDeltas.sessions >= 0 ? 'text-success' : 'text-error'"
        >
          {{ gaDeltas.sessions >= 0 ? '+' : '' }}{{ gaDeltas.sessions.toFixed(1) }}% vs prev
        </p>
      </div>
      <div class="rounded-xl border border-default bg-elevated/30 p-4">
        <p class="text-sm font-medium text-muted">Pageviews</p>
        <p class="mt-1 text-xl font-semibold text-default">
          {{ gaSummary.pageviews.toLocaleString() }}
        </p>
        <p
          v-if="gaDeltas?.pageviews !== undefined"
          class="mt-0.5 text-xs"
          :class="gaDeltas.pageviews >= 0 ? 'text-success' : 'text-error'"
        >
          {{ gaDeltas.pageviews >= 0 ? '+' : '' }}{{ gaDeltas.pageviews.toFixed(1) }}% vs prev
        </p>
      </div>
      <div class="rounded-xl border border-default bg-elevated/30 p-4">
        <p class="text-sm font-medium text-muted">Bounce Rate</p>
        <p class="mt-1 text-xl font-semibold text-default">
          {{ (gaSummary.bounceRate * 100).toFixed(1) }}%
        </p>
        <p
          v-if="gaDeltas?.bounceRate !== undefined"
          class="mt-0.5 text-xs"
          :class="gaDeltas.bounceRate <= 0 ? 'text-success' : 'text-error'"
        >
          {{ gaDeltas.bounceRate >= 0 ? '+' : '' }}{{ gaDeltas.bounceRate.toFixed(1) }}% vs prev
        </p>
      </div>
      <div class="rounded-xl border border-default bg-elevated/30 p-4">
        <p class="text-sm font-medium text-muted">Avg Session</p>
        <p class="mt-1 text-xl font-semibold text-default">
          {{
            gaSummary.avgSessionDuration >= 60
              ? `${Math.floor(gaSummary.avgSessionDuration / 60)}m `
              : ''
          }}{{ Math.floor(gaSummary.avgSessionDuration % 60) }}s
        </p>
        <p
          v-if="gaDeltas?.avgSessionDuration !== undefined"
          class="mt-0.5 text-xs"
          :class="gaDeltas.avgSessionDuration >= 0 ? 'text-success' : 'text-error'"
        >
          {{ gaDeltas.avgSessionDuration >= 0 ? '+' : ''
          }}{{ gaDeltas.avgSessionDuration.toFixed(1) }}% vs prev
        </p>
      </div>
      <div class="rounded-xl border border-default bg-elevated/30 p-4">
        <p class="text-sm font-medium text-muted">Engagement</p>
        <p class="mt-1 text-xl font-semibold text-default">
          {{ (gaSummary.engagementRate * 100).toFixed(1) }}%
        </p>
      </div>
    </div>

    <!-- Traffic Chart -->
    <UCard>
      <template #header>
        <h2 class="text-sm font-medium text-default">Traffic ({{ presetLabel }})</h2>
      </template>
      <AnalyticsLineChart
        :data="gaTimeSeries"
        :title="`Pageviews — ${gaData?.startDate ?? ''} to ${gaData?.endDate ?? ''}`"
      />
    </UCard>

    <!-- GSC Summary Strip -->
    <div v-if="gscQueryData?.totals" class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div class="rounded-xl border border-default bg-elevated/30 p-4">
        <p class="text-sm font-medium text-muted">GSC Clicks</p>
        <p class="mt-1 text-xl font-semibold text-default">
          {{ (gscTotals?.clicks ?? 0).toLocaleString() }}
        </p>
      </div>
      <div class="rounded-xl border border-default bg-elevated/30 p-4">
        <p class="text-sm font-medium text-muted">Impressions</p>
        <p class="mt-1 text-xl font-semibold text-default">
          {{ (gscTotals?.impressions ?? 0).toLocaleString() }}
        </p>
      </div>
      <div class="rounded-xl border border-default bg-elevated/30 p-4">
        <p class="text-sm font-medium text-muted">CTR</p>
        <p class="mt-1 text-xl font-semibold text-default">
          {{ ((gscTotals?.ctr ?? 0) * 100).toFixed(2) }}%
        </p>
      </div>
      <div class="rounded-xl border border-default bg-elevated/30 p-4">
        <p class="text-sm font-medium text-muted">Avg Position</p>
        <p class="mt-1 text-xl font-semibold text-default">
          {{ (gscTotals?.position ?? 0).toFixed(1) }}
        </p>
      </div>
    </div>

    <!-- Data Breakdowns -->
    <div class="grid gap-4 md:grid-cols-2">
      <FleetTopDimensionCard
        title="Top Pages"
        icon="i-lucide-file-text"
        :items="posthogData?.topPages ?? []"
      />
      <UCard v-if="gscQueryData?.rows?.length" class="overflow-hidden">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-search" class="text-primary-500" />
            <h3 class="text-sm font-medium">Top Queries (GSC)</h3>
          </div>
        </template>
        <div class="max-h-64 overflow-auto">
          <UTable
            :data="gscTopQueries"
            :columns="[
              {
                accessorKey: 'keys',
                header: 'Query',
                meta: { class: { td: 'max-w-[180px] truncate' } },
                cell: ({ row }) => row.original.keys?.[0] ?? '—',
              },
              {
                accessorKey: 'clicks',
                header: 'Clicks',
                cell: ({ row }) => (row.original.clicks ?? 0).toLocaleString(),
              },
            ]"
            class="text-xs"
          />
        </div>
      </UCard>
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
      <UCard v-if="gscDeviceData?.rows?.length" class="overflow-hidden">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-smartphone" class="text-primary-500" />
            <h3 class="text-sm font-medium">Device (GSC)</h3>
          </div>
        </template>
        <div class="max-h-48 overflow-auto">
          <UTable
            :data="gscTopDevices"
            :columns="[
              {
                accessorKey: 'keys',
                header: 'Device',
                cell: ({ row }) => row.original.keys?.[0] ?? '—',
              },
              {
                accessorKey: 'clicks',
                header: 'Clicks',
                cell: ({ row }) => (row.original.clicks ?? 0).toLocaleString(),
              },
            ]"
            class="text-xs"
          />
        </div>
      </UCard>
    </div>

    <!-- URL Inspection -->
    <UCard v-if="gscInspection?.indexStatusResult">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon
            :name="
              gscInspection.indexStatusResult.verdict === 'PASS'
                ? 'i-lucide-check-circle'
                : 'i-lucide-alert-circle'
            "
            :class="
              gscInspection.indexStatusResult.verdict === 'PASS' ? 'text-success' : 'text-warning'
            "
            class="size-5"
          />
          <h3 class="text-sm font-medium text-default">URL Inspection</h3>
        </div>
      </template>
      <p class="text-sm text-muted">
        {{ gscInspection.indexStatusResult.coverageState ?? 'Unknown coverage state' }}
      </p>
      <div class="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        <span v-if="formattedLastCrawlTime">Last crawled: {{ formattedLastCrawlTime }}</span>
        <span v-if="formattedCrawledAs">Agent: {{ formattedCrawledAs }}</span>
      </div>
      <UButton
        v-if="gscInspection.inspectionResultLink"
        :to="gscInspection.inspectionResultLink"
        target="_blank"
        variant="outline"
        size="sm"
        class="mt-3 cursor-pointer"
        icon="i-lucide-external-link"
      >
        View in GSC
      </UButton>
    </UCard>

    <!-- Sitemap analysis -->
    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-map" class="text-primary-500 size-5" />
            <h3 class="text-sm font-medium text-default">Sitemap analysis</h3>
          </div>
          <div class="flex gap-2">
            <UButton
              size="xs"
              variant="outline"
              color="neutral"
              :loading="sitemapLoading"
              class="cursor-pointer"
              icon="i-lucide-file-search"
              @click="runSitemapAnalysis(false)"
            >
              Run analysis
            </UButton>
            <UButton
              size="xs"
              variant="outline"
              color="primary"
              :loading="sitemapLoading"
              class="cursor-pointer"
              icon="i-lucide-scan-search"
              @click="runSitemapAnalysis(true)"
            >
              Deep analysis
            </UButton>
          </div>
        </div>
      </template>
      <p class="text-sm text-muted">
        Fetch sitemap.xml and list all URLs. Deep analysis runs HEAD requests on each URL (up to
        200) for status and response time.
      </p>
      <div
        v-if="sitemapError"
        class="mt-3 rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error"
      >
        {{ sitemapError.message }}
      </div>
      <div v-else-if="sitemapData" class="mt-4 space-y-4">
        <div class="flex flex-wrap gap-4 text-sm">
          <span class="font-medium text-default">Sitemap:</span>
          <ULink
            :to="sitemapData.sitemapUrl"
            target="_blank"
            rel="noopener"
            class="text-primary hover:underline"
          >
            {{ sitemapData.sitemapUrl }}
          </ULink>
        </div>
        <div class="flex flex-wrap gap-6 text-sm">
          <span
            ><strong class="text-default">{{ sitemapData.totalUrls }}</strong>
            <span class="text-muted">URLs</span></span
          >
          <template v-if="sitemapData.deepSummary">
            <span
              ><strong class="text-success">{{ sitemapData.deepSummary.ok }}</strong>
              <span class="text-muted">OK</span></span
            >
            <span
              ><strong class="text-error">{{ sitemapData.deepSummary.error }}</strong>
              <span class="text-muted">errors</span></span
            >
            <span v-if="sitemapData.deepSummary.timeout > 0"
              ><strong class="text-warning">{{ sitemapData.deepSummary.timeout }}</strong>
              <span class="text-muted">timeouts</span></span
            >
            <span
              ><span class="text-muted">Avg</span>
              <strong class="text-default"
                >{{ sitemapData.deepSummary.avgDurationMs }} ms</strong
              ></span
            >
          </template>
        </div>
        <div
          v-if="sitemapData.entries?.length"
          class="max-h-80 overflow-auto rounded-lg border border-default"
        >
          <UTable
            :data="sitemapData.entries"
            :columns="[
              {
                accessorKey: 'url',
                header: 'URL',
                meta: { class: { td: 'max-w-[320px] truncate font-mono text-xs' } },
                cell: ({ row }) => row.original.url,
              },
              {
                accessorKey: 'status',
                header: 'Status',
                cell: ({ row }) => row.original.status || '—',
              },
              {
                accessorKey: 'durationMs',
                header: 'Time (ms)',
                cell: ({ row }) => row.original.durationMs,
              },
              {
                accessorKey: 'error',
                header: 'Error',
                cell: ({ row }) => row.original.error ?? '—',
              },
            ]"
            class="text-xs"
          />
        </div>
        <div
          v-else-if="sitemapData.urls?.length"
          class="max-h-48 overflow-auto rounded-lg border border-default p-2"
        >
          <ul class="list-inside list-disc space-y-1 font-mono text-xs text-muted">
            <li v-for="u in sitemapUrlsPreview" :key="u" class="truncate">
              <ULink :to="u" target="_blank" rel="noopener" class="text-primary hover:underline">{{
                u
              }}</ULink>
            </li>
          </ul>
          <p v-if="sitemapData.urls.length > 50" class="mt-2 text-xs text-muted">
            + {{ sitemapData.urls.length - 50 }} more URLs
          </p>
        </div>
      </div>
    </UCard>

    <!-- Quick Actions -->
    <UCard>
      <template #header>
        <h3 class="text-sm font-medium text-default">Quick Actions</h3>
      </template>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="posthogData?.replaysUrl"
          :to="posthogData.replaysUrl"
          target="_blank"
          variant="outline"
          color="neutral"
          icon="i-lucide-video"
          class="cursor-pointer"
        >
          Session Replays
        </UButton>
        <NuxtLink :to="`/analytics/${appName}/search`">
          <UButton variant="outline" color="neutral" icon="i-lucide-search" class="cursor-pointer">
            GSC Search
          </UButton>
        </NuxtLink>
        <UButton
          v-if="gscInspection?.inspectionResultLink"
          :to="gscInspection.inspectionResultLink"
          target="_blank"
          variant="outline"
          color="neutral"
          icon="i-lucide-bar-chart-3"
          class="cursor-pointer"
        >
          View in GSC
        </UButton>
        <UButton
          :loading="indexnowLoading"
          class="cursor-pointer"
          icon="i-lucide-send"
          @click="submitIndexnow()"
        >
          IndexNow Submit
        </UButton>
        <NuxtLink to="/analytics">
          <UButton
            variant="ghost"
            color="neutral"
            icon="i-lucide-arrow-left"
            class="cursor-pointer"
          >
            Back to fleet
          </UButton>
        </NuxtLink>
      </div>
    </UCard>

    <!-- Errors -->
    <div v-if="gaError" class="rounded-lg border border-error/30 bg-error/5 p-4">
      <p class="text-sm font-medium text-error">Google Analytics error</p>
      <p class="mt-1 text-sm text-muted">{{ gaError.message }}</p>
    </div>
    <div v-if="posthogError" class="rounded-lg border border-error/30 bg-error/5 p-4">
      <p class="text-sm font-medium text-error">PostHog error</p>
      <p class="mt-1 text-sm text-muted">{{ posthogError.message }}</p>
    </div>
    <div v-if="sitemapError" class="rounded-lg border border-error/30 bg-error/5 p-4">
      <p class="text-sm font-medium text-error">Sitemap analysis error</p>
      <p class="mt-1 text-sm text-muted">{{ sitemapError.message }}</p>
    </div>
  </div>
</template>
