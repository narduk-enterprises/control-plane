<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { GscRow } from '~/composables/useFleetGscQuery';

useSeo({
  title: 'Analytics Dashboard',
  description: 'Combined GA, GSC, and PostHog Analytics capabilities.',
});
useWebPageSchema({
  name: 'Analytics Dashboard',
  description: 'Data-dense comparison dashboard.',
});

// Fleet Apps
const { apps } = useFleetDashboard();
const fleetApps = computed(() => apps.value ?? []);
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

// Data sources
const forceRefresh = ref(false);

// 1. Google Analytics
const {
  data: gaData,
  loading: gaLoading,
  load: gaLoad,
} = useFleetGA(selectedAppName, startRef, endRef, forceRefresh);
// 2. Google Search Console
const gscParams = computed(() => ({
  startDate: startRef.value,
  endDate: endRef.value,
  dimension: 'page' as const,
  force: forceRefresh.value,
}));
const {
  data: gscData,
  loading: gscLoading,
  load: gscLoad,
} = useFleetGscQuery(selectedAppName, gscParams);
// 3. PostHog
const {
  data: posthogData,
  loading: posthogLoading,
  load: posthogLoad,
} = useFleetPosthog(selectedAppName, startRef, endRef, forceRefresh);

async function refreshAll() {
  if (!selectedAppName.value) return;
  forceRefresh.value = true;
  await Promise.all([gaLoad(), gscLoad(), posthogLoad()]);
  forceRefresh.value = false;
}

// Watch app or date range to load data implicitly
watch(
  [selectedAppName, startRef, endRef],
  () => {
    if (!selectedAppName.value || !startRef.value || !endRef.value) return;
    // Don't force refresh when changing dates/app, just trigger loads
    Promise.all([gaLoad(), gscLoad(), posthogLoad()]);
  },
  { immediate: true }
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
        <USelect
          v-model="selectedAppName"
          :options="fleetApps.map((a) => ({ label: a.name, value: a.name }))"
          placeholder="Select an app"
          class="w-48"
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
        :ga-data="gaTimeSeries"
        :gsc-data="gscTimeSeries"
        :posthog-data="phTimeSeries"
        :title="`Metrics Trend for ${selectedAppName || '...'}`"
      />
    </div>

    <!-- KPI Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <!-- GA KPIs -->
      <UCard>
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
      <UCard>
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
