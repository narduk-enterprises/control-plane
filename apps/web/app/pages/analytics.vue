<script setup lang="ts">
import { computed, ref } from 'vue';
import type { GscRow } from '~/composables/useFleetGscQuery';

interface GAData {
  app: string
  propertyId: string
  summary: Record<string, number> | null
  deltas: Record<string, number> | null
  timeSeries: { date: string, value: number }[]
  startDate: string
  endDate: string
}

interface PosthogData {
  app: string
  summary: Record<string, number>
  timeSeries: { date: string, value: number }[]
  topPages: { name: string, count: number }[]
  topReferrers: { name: string, count: number }[]
  topCountries: { name: string, count: number }[]
  topBrowsers: { name: string, count: number }[]
  replaysUrl: string
  startDate: string
  endDate: string
}

interface GscData {
  app: string
  rows: GscRow[]
  totals: { clicks?: number, impressions?: number, ctr?: number, position?: number } | null
  inspection: unknown
  startDate: string
  endDate: string
  dimension: string
}

useSeo({
  title: 'Analytics Dashboard',
  description: 'Combined GA, GSC, and PostHog Analytics capabilities.',
});
useWebPageSchema({
  name: 'Analytics Dashboard',
  description: 'Data-dense comparison dashboard.',
});

// Fleet Apps
const { apps: fleetApps } = useFleet();
const selectedAppName = ref<string>('');

watch(
  fleetApps,
  (newApps) => {
    if (newApps.length > 0 && !selectedAppName.value) {
      selectedAppName.value = newApps[0]?.name ?? '';
    }
  },
  { immediate: true }
);

// Date Range
const dateState = useAnalyticsDateRange('30d');
const presetRef = dateState.preset;
const startRef = dateState.startDate;
const endRef = dateState.endDate;
const optsRef = dateState.presetOptions;
const setPresetFn = dateState.setPreset;
const is1hRef = dateState.is1h;

// Data sources — watch: false, manually triggered via loadAll()
const forceFlag = ref(false);

// 1. Google Analytics
const {
  data: gaDataRaw,
  loading: gaLoading,
  load: gaLoad,
} = useFleetGA(selectedAppName, startRef, endRef, forceFlag);
const gaData = gaDataRaw as Ref<GAData | null>;

// 2. Google Search Console
const gscParams = computed(() => ({
  startDate: startRef.value,
  endDate: endRef.value,
  dimension: 'page' as const,
  force: forceFlag.value,
}));
const {
  data: gscDataRaw,
  loading: gscLoading,
  load: gscLoad,
} = useFleetGscQuery(selectedAppName, gscParams);
const gscData = gscDataRaw as Ref<GscData | null>;

// 3. PostHog
const {
  data: posthogDataRaw,
  loading: posthogLoading,
  load: posthogLoad,
} = useFleetPosthog(selectedAppName, startRef, endRef, forceFlag);
const posthogData = posthogDataRaw as Ref<PosthogData | null>;

// Unified load function — loads all relevant data sources
async function loadAll(force = false) {
  if (!selectedAppName.value) return;
  forceFlag.value = force;
  await nextTick();
  const reqs: Promise<void>[] = [posthogLoad()];
  if (!is1hRef.value) reqs.push(gaLoad(), gscLoad());
  await Promise.all(reqs);
  if (force) forceFlag.value = false;
}

async function refreshAll() {
  await loadAll(true);
}

// 4. IndexNow Summary
const { data: indexnowSummary, status: indexnowStatus } = useFleetIndexnowSummary()

// Watch app or date range to load data
watch(
  [selectedAppName, startRef, endRef],
  () => {
    loadAll();
  },
);

// Derived chart data
const gaTimeSeries = computed(() => gaData.value?.timeSeries ?? []);
// GSC might not natively return timeSeries like GA/Posthog does, but we assume we built useFleetGscQuery to return rows mapped to timeSeries.
const gscTimeSeries = computed(() => {
  if (!gscData.value?.rows) return [];
  return gscData.value.rows.map((r: GscRow) => ({
    date: r.keys?.[0] ?? '',
    value: r.clicks ?? 0,
  }));
});
const phTimeSeries = computed(() => posthogData.value?.timeSeries ?? []);

const gaSummary = computed(() => gaData.value?.summary as Record<string, number> | null);
const phSummary = computed(() => posthogData.value?.summary as Record<string, number> | null);

const gscTotalClicks = computed(() => {
  if (!gscData.value?.rows) return 0;
  return gscData.value.rows.reduce((sum: number, r: GscRow) => sum + (r.clicks ?? 0), 0);
});
const gscTotalImpressions = computed(() => {
  if (!gscData.value?.rows) return 0;
  return gscData.value.rows.reduce((sum: number, r: GscRow) => sum + (r.impressions ?? 0), 0);
});
const gscAvgCtr = computed(() => {
  if (!gscData.value?.rows || gscData.value.rows.length === 0) return 0;
  return (
    (gscData.value.rows.reduce((sum: number, r: GscRow) => sum + (r.ctr ?? 0), 0) /
      gscData.value.rows.length) *
    100
  );
});
const gscAvgPosition = computed(() => {
  if (!gscData.value?.rows || gscData.value.rows.length === 0) return 0;
  return (
    gscData.value.rows.reduce((sum: number, r: GscRow) => sum + (r.position ?? 0), 0) /
    gscData.value.rows.length
  );
});

const topPagesColumns = [
  { accessorKey: 'name', header: 'Page Path' },
  {
    accessorKey: 'count',
    header: 'Views',
    meta: { class: { th: 'text-right', td: 'text-right font-medium' } },
  },
];

const topReferrersColumns = [
  { accessorKey: 'name', header: 'Source' },
  {
    accessorKey: 'count',
    header: 'Visits',
    meta: { class: { th: 'text-right', td: 'text-right font-medium' } },
  },
];

const breadcrumbItems = computed(() => [{ label: 'Dashboard', to: '/' }, { label: 'Analytics' }]);
</script>

<template>
  <div class="pb-12">
    <AppBreadcrumbs :items="breadcrumbItems" />
    <div class="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h1 class="font-display text-2xl font-semibold text-default flex items-center gap-2">
          <UIcon name="i-lucide-activity" class="size-6 text-primary" />
          Analytics Dashboard
        </h1>
        <p class="mt-1 text-sm text-muted">
          Compare pageviews, clicks, and events across providers.
        </p>
      </div>

      <div class="flex flex-col sm:flex-row items-end sm:items-center gap-4">
        <!-- App Selector -->
        <USelectMenu
          v-model="selectedAppName"
          :items="fleetApps"
          value-key="name"
          label-key="name"
          placeholder="Select an app"
          class="w-48 bg-white"
        />

        <!-- Date Range Presets -->
        <div class="flex flex-wrap items-center gap-2">
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

          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            size="xs"
            class="cursor-pointer"
            :loading="gaLoading || gscLoading || posthogLoading"
            @click="refreshAll"
          >
            Refresh
          </UButton>
        </div>
      </div>
    </div>

    <!-- Date Pickers (if custom) -->
    <div
      v-if="presetRef === 'custom'"
      class="mb-6 flex items-center gap-2 bg-elevated/50 p-2 rounded-lg w-fit border border-default"
    >
      <UInput type="date" v-model="startRef" size="sm" />
      <span class="text-xs text-muted">to</span>
      <UInput type="date" v-model="endRef" size="sm" />
    </div>

    <!-- Main Chart -->
    <div class="mb-8">
      <AnalyticsCombinedChart
        v-if="!is1hRef"
        :ga-data="gaTimeSeries"
        :gsc-data="gscTimeSeries"
        :posthog-data="phTimeSeries"
        :title="`Metrics Trend for ${selectedAppName || '...'}`"
      />
      <UAlert
        v-else
        icon="i-lucide-info"
        title="Hourly filtering active"
        description="Google Analytics and Search Console data are hidden because they only support daily granularity."
        color="info"
        variant="subtle"
      />
    </div>

    <!-- KPI Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <!-- GA KPIs -->
      <UCard v-if="!is1hRef">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-bar-chart-2" class="text-primary size-5" />
            <h3 class="font-medium">Google Analytics</h3>
            <USkeleton v-if="gaLoading && !gaData" class="w-12 h-4" />
          </div>
        </template>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-muted mb-1">Unique Users</p>
            <p class="text-xl font-semibold">
              {{ gaSummary?.activeUsers?.toLocaleString() ?? '-' }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Pageviews</p>
            <p class="text-xl font-semibold">
              {{ gaSummary?.screenPageViews?.toLocaleString() ?? '-' }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Bounce Rate</p>
            <p class="text-xl font-semibold">
              {{ gaSummary?.bounceRate ? (gaSummary.bounceRate * 100).toFixed(1) + '%' : '-' }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Avg Session</p>
            <p class="text-xl font-semibold">
              {{
                gaSummary?.averageSessionDuration
                  ? Math.round(gaSummary.averageSessionDuration) + 's'
                  : '-'
              }}
            </p>
          </div>
        </div>
      </UCard>

      <!-- PostHog KPIs -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-users" class="text-warning size-5" />
            <h3 class="font-medium">PostHog</h3>
            <USkeleton v-if="posthogLoading && !posthogData" class="w-12 h-4" />
          </div>
        </template>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-muted mb-1">Total Events</p>
            <p class="text-xl font-semibold">
              {{ phSummary?.eventCount?.toLocaleString() ?? '-' }}
            </p>
          </div>
        </div>
      </UCard>

      <!-- GSC KPIs -->
      <UCard v-if="!is1hRef">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-bar-chart-3" class="text-info size-5" />
            <h3 class="font-medium">Search Console</h3>
            <USkeleton v-if="gscLoading && !gscData" class="w-12 h-4" />
          </div>
        </template>
        <div class="grid grid-cols-2 gap-4" v-if="gscData?.rows?.length">
          <div>
            <p class="text-xs text-muted mb-1">Total Clicks</p>
            <p class="text-xl font-semibold">
              {{ gscTotalClicks.toLocaleString() }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Total Impressions</p>
            <p class="text-xl font-semibold">
              {{ gscTotalImpressions.toLocaleString() }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Avg CTR</p>
            <p class="text-xl font-semibold">{{ gscAvgCtr.toFixed(2) }}%</p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Avg Position</p>
            <p class="text-xl font-semibold">
              {{ gscAvgPosition.toFixed(1) }}
            </p>
          </div>
        </div>
        <div v-else class="text-sm text-muted">No search data or still loading.</div>
      </UCard>

      <!-- IndexNow KPIs -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-send" class="text-success size-5" />
            <h3 class="font-medium">IndexNow</h3>
            <USkeleton v-if="indexnowStatus === 'pending' && !indexnowSummary" class="w-12 h-4" />
          </div>
        </template>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-muted mb-1">Total Pings</p>
            <p class="text-xl font-semibold">
              {{ indexnowSummary?.totalSubmissions?.toLocaleString() ?? '-' }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">Active Apps</p>
            <p class="text-xl font-semibold">
              {{ indexnowSummary?.appsWithIndexnow ?? 0 }}/{{ indexnowSummary?.totalFleetSize ?? 0 }}
            </p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Data Tables -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- GA Top Pages -->
      <UCard>
        <template #header>
          <h3 class="font-medium text-sm flex items-center gap-2">
            <UIcon name="i-lucide-file-text" class="size-4" />
            Top Pages (PostHog)
          </h3>
        </template>
        <div class="overflow-x-auto rounded-lg border border-default">
          <UTable
            v-if="posthogData?.topPages?.length"
            :columns="topPagesColumns"
            :data="posthogData.topPages"
            class="min-w-full"
          />
          <div v-else class="px-4 py-8 text-center text-muted">No top pages data available</div>
        </div>
      </UCard>

      <!-- PostHog Top Referrers -->
      <UCard>
        <template #header>
          <h3 class="font-medium text-sm flex items-center gap-2">
            <UIcon name="i-lucide-link" class="size-4" />
            Top Referrers (PostHog)
          </h3>
        </template>
        <div class="overflow-x-auto rounded-lg border border-default">
          <UTable
            v-if="posthogData?.topReferrers?.length"
            :columns="topReferrersColumns"
            :data="posthogData.topReferrers"
            class="min-w-full"
          />
          <div v-else class="px-4 py-8 text-center text-muted">No referrers data available</div>
        </div>
      </UCard>
    </div>
  </div>
</template>
