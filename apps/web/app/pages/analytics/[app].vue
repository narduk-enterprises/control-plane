<script setup lang="ts">
import type { AnalyticsSurface } from '~/utils/analyticsPresentation'
import {
  ANALYTICS_SURFACE_OPTIONS,
  analyticsSurfaceHref,
  normalizeAnalyticsSurface,
  providerLabel,
  providerStatusColor,
} from '~/utils/analyticsPresentation'

const route = useRoute()
const router = useRouter()
const appName = computed(() => String(route.params.app ?? ''))

useSeo({
  title: `${appName.value} — Analytics`,
  description: `Canonical analytics snapshot for ${appName.value}.`,
})
useWebPageSchema({
  name: 'App Analytics Snapshot',
  description: 'Single-app analytics view with provider health and drilldowns.',
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

const snapshotEnabled = computed(
  () => currentSurface.value === 'overview' || currentSurface.value === 'indexing',
)

const {
  preset,
  startDate,
  endDate,
  dateState,
  snapshot,
  detailLoading,
  detailError,
  detailRevalidating,
  refreshDetail,
} = useAnalyticsAppDetail(appName, { enabled: snapshotEnabled })

const isDateBoundSurface = computed(() => currentSurface.value !== 'indexing')
const {
  gaMetrics,
  posthogMetrics,
  gscMetrics,
  currentLoading,
  currentError,
  surfaceBlocksSelectedRange,
  blockedRangeMessage,
  refreshCurrentSurface,
} = useAnalyticsAppSurfaceData(appName, currentSurface)

const dateBarLoading = computed(() =>
  currentSurface.value === 'overview'
    ? detailLoading.value || detailRevalidating.value
    : currentLoading.value,
)

const overviewCards = computed(() => {
  if (!snapshot.value) return []

  const gaSummary = snapshot.value.ga.metrics?.summary
  const gscTotals = snapshot.value.gsc.metrics?.totals
  const posthogSummary = snapshot.value.posthog.metrics?.summary
  const indexnowMetrics = snapshot.value.indexnow.metrics

  return [
    {
      key: 'ga',
      label: providerLabel('ga'),
      href: analyticsSurfaceHref('ga', appName.value),
      status: snapshot.value.ga.status,
      message: snapshot.value.ga.message,
      hint: snapshot.value.app.gaPropertyId
        ? `Property ${snapshot.value.app.gaPropertyId}`
        : 'No GA4 property configured',
      metrics: [
        { label: 'Users', value: String(gaSummary?.activeUsers?.toLocaleString() ?? 0) },
        { label: 'Pageviews', value: String(gaSummary?.screenPageViews?.toLocaleString() ?? 0) },
      ],
    },
    {
      key: 'gsc',
      label: providerLabel('gsc'),
      href: analyticsSurfaceHref('gsc', appName.value),
      status: snapshot.value.gsc.status,
      message: snapshot.value.gsc.message,
      hint: snapshot.value.gsc.metrics?.siteUrl || snapshot.value.app.url,
      metrics: [
        { label: 'Clicks', value: String(gscTotals?.clicks?.toLocaleString() ?? 0) },
        { label: 'Impressions', value: String(gscTotals?.impressions?.toLocaleString() ?? 0) },
      ],
    },
    {
      key: 'posthog',
      label: providerLabel('posthog'),
      href: analyticsSurfaceHref('posthog', appName.value),
      status: snapshot.value.posthog.status,
      message: snapshot.value.posthog.message,
      hint: snapshot.value.app.posthogAppName
        ? `Project ${snapshot.value.app.posthogAppName}`
        : 'Using app slug fallback',
      metrics: [
        {
          label: 'Events',
          value: String(Number(posthogSummary?.event_count ?? 0).toLocaleString()),
        },
        {
          label: 'Users',
          value: String(Number(posthogSummary?.unique_users ?? 0).toLocaleString()),
        },
      ],
    },
    {
      key: 'indexnow',
      label: providerLabel('indexnow'),
      href: analyticsSurfaceHref('indexing', appName.value),
      status: snapshot.value.indexnow.status,
      message: snapshot.value.indexnow.message,
      hint: 'IndexNow + sitemap operations',
      metrics: [
        {
          label: 'Submits',
          value: String(indexnowMetrics?.totalSubmissions?.toLocaleString() ?? 0),
        },
        {
          label: 'Last batch',
          value: String(indexnowMetrics?.lastSubmittedCount?.toLocaleString() ?? 'Unknown'),
        },
      ],
    },
  ]
})

const providerBadges = computed(() => {
  if (!snapshot.value) return []
  return [
    { label: 'GA4', status: snapshot.value.ga.status },
    { label: 'GSC', status: snapshot.value.gsc.status },
    { label: 'PostHog', status: snapshot.value.posthog.status },
    { label: 'IndexNow', status: snapshot.value.indexnow.status },
  ]
})

const breadcrumbItems = computed(() => [
  { label: 'Dashboard', to: '/' },
  { label: 'Analytics', to: '/analytics' },
  { label: appName.value },
])
</script>

<template>
  <div class="space-y-6 overflow-hidden pb-12">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div class="min-w-0">
        <h1 class="truncate font-display text-2xl font-semibold text-default">{{ appName }}</h1>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <UBadge
            v-if="snapshot"
            :color="
              snapshot.health.status === 'up'
                ? 'success'
                : snapshot.health.status === 'down'
                  ? 'error'
                  : 'neutral'
            "
            variant="subtle"
            size="sm"
          >
            {{ snapshot.health.status }}
          </UBadge>
          <UBadge
            v-for="provider in providerBadges"
            :key="provider.label"
            :color="providerStatusColor(provider.status)"
            variant="soft"
            size="sm"
          >
            {{ provider.label }}
          </UBadge>
          <UBadge v-if="detailRevalidating" color="primary" variant="subtle" size="sm">
            Updating…
          </UBadge>
        </div>
      </div>

      <AnalyticsDateBar
        v-if="isDateBoundSurface"
        :preset-options="dateState.presetOptions"
        :active-preset="preset"
        :loading="dateBarLoading"
        show-refresh
        v-model:start-date="startDate"
        v-model:end-date="endDate"
        @preset="dateState.setPreset($event)"
        @refresh="currentSurface === 'overview' ? refreshDetail() : refreshCurrentSurface()"
      />
    </div>

    <AnalyticsSectionTabs v-model="currentSurface" :items="ANALYTICS_SURFACE_OPTIONS" />

    <UAlert
      v-if="surfaceBlocksSelectedRange"
      icon="i-lucide-info"
      :title="blockedRangeMessage?.title"
      :description="blockedRangeMessage?.description"
      color="info"
      variant="subtle"
    />

    <AnalyticsErrorAlert
      v-if="currentSurface === 'overview' ? detailError : currentError"
      :provider="
        currentSurface === 'overview'
          ? 'App snapshot'
          : currentSurface === 'ga' || currentSurface === 'gsc' || currentSurface === 'posthog'
            ? providerLabel(currentSurface)
            : 'App detail'
      "
      :error="currentSurface === 'overview' ? detailError : (currentError ?? null)"
      @retry="currentSurface === 'overview' ? refreshDetail() : refreshCurrentSurface()"
    />

    <template v-if="!surfaceBlocksSelectedRange">
      <div v-if="currentSurface === 'overview'" class="space-y-4">
        <div v-if="overviewCards.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AnalyticsProviderStateCard
            v-for="card in overviewCards"
            :key="card.key"
            :app-name="card.label"
            :href="card.href"
            :status="card.status"
            :message="card.message"
            :hint="card.hint"
            :metrics="card.metrics"
            action-label="Open provider detail"
          />
        </div>

        <AnalyticsQuickActions
          :app-name="appName"
          :replays-url="snapshot?.posthog.metrics?.replaysUrl ?? undefined"
          :inspection-link="snapshot?.gsc.metrics?.inspection?.inspectionResultLink"
        />
      </div>

      <AnalyticsGaDetailSection
        v-else-if="currentSurface === 'ga'"
        :metrics="gaMetrics"
        :loading="currentLoading"
        :start-date="startDate"
        :end-date="endDate"
      />

      <AnalyticsGscDetailSection
        v-else-if="currentSurface === 'gsc'"
        :metrics="gscMetrics"
        :loading="currentLoading"
        :start-date="startDate"
        :end-date="endDate"
      />

      <AnalyticsPosthogDetailSection
        v-else-if="currentSurface === 'posthog'"
        :metrics="posthogMetrics"
        :loading="currentLoading"
      />

      <AnalyticsIndexingDetailSection
        v-else
        :app-name="appName"
        :provider="snapshot?.indexnow ?? null"
      />
    </template>
  </div>
</template>
