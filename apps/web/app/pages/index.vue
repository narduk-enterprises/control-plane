<script setup lang="ts">
import { h } from 'vue'
import { FleetAppStatus, NuxtLink, UButton } from '#components'
import type { TableColumn } from '~/types/table'
import { useAnalyticsStore } from '~/stores/analytics'
import type { FleetRegistryApp } from '~/types/fleet'

useSeo({
  title: 'Dashboard',
  description: 'Operational dashboard with the canonical 30-day analytics snapshot.',
  ogImage: { title: 'Narduk Control Plane Dashboard', description: 'Fleet operations.', icon: '⚙️' },
})
useWebPageSchema({
  name: 'Narduk Control Plane — Dashboard',
  description: 'Fleet operations dashboard.',
})

const analyticsStore = useAnalyticsStore()
const {
  apps: fleetApps,
  getAppStatus,
  refreshStatuses,
  forceRefreshApps,
} = useFleet()

const thirtyDayRange = computed(() => {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 30)
  return {
    startDate: start.toISOString().split('T')[0] ?? '',
    endDate: end.toISOString().split('T')[0] ?? '',
  }
})

const summary = computed(() => analyticsStore.getSummary(thirtyDayRange.value))
const summaryLoading = computed(
  () => analyticsStore.getSummaryStatus(thirtyDayRange.value) === 'pending',
)

onMounted(() => {
  void analyticsStore.fetchSummary({ range: thirtyDayRange.value })
})

async function refreshDashboard() {
  await Promise.all([
    analyticsStore.fetchSummary({ range: thirtyDayRange.value, force: true }),
    refreshStatuses(),
    forceRefreshApps(),
  ])
}

const tableData = computed(() =>
  fleetApps.value.map((app) => {
    const snapshot = summary.value?.apps[app.name]
    return {
      ...app,
      users: snapshot?.ga.metrics?.summary?.activeUsers ?? 0,
      pageviews: snapshot?.ga.metrics?.summary?.screenPageViews ?? 0,
      clicks: snapshot?.gsc.metrics?.totals?.clicks ?? 0,
      events: Number(snapshot?.posthog.metrics?.summary?.event_count ?? 0),
      providers: [snapshot?.ga.status, snapshot?.gsc.status, snapshot?.posthog.status].filter(
        (status) => status === 'healthy',
      ).length,
    }
  }),
)

const upCount = computed(
  () => fleetApps.value.filter((app) => getAppStatus(app.name)?.status === 'up').length,
)
const downCount = computed(
  () => fleetApps.value.filter((app) => getAppStatus(app.name)?.status === 'down').length,
)
const providerIssueCount = computed(() => {
  if (!summary.value) return 0
  const totals = summary.value.totals.problemProviders
  return totals.ga + totals.gsc + totals.posthog + totals.indexnow
})

interface DashboardRow extends FleetRegistryApp {
  users: number
  pageviews: number
  clicks: number
  events: number
  providers: number
}

const columns: TableColumn<DashboardRow>[] = [
  {
    accessorKey: 'name',
    header: 'App',
    cell: ({ row }) =>
      h(
        NuxtLink,
        {
          to: `/analytics/${row.original.name}`,
          class: 'font-medium text-primary hover:underline',
        },
        () => row.original.name,
      ),
  },
  {
    accessorKey: 'users',
    header: 'Users',
    cell: ({ row }) => row.original.users.toLocaleString(),
  },
  {
    accessorKey: 'pageviews',
    header: 'Pageviews',
    cell: ({ row }) => row.original.pageviews.toLocaleString(),
  },
  {
    accessorKey: 'clicks',
    header: 'GSC Clicks',
    cell: ({ row }) => row.original.clicks.toLocaleString(),
  },
  {
    accessorKey: 'events',
    header: 'Events',
    cell: ({ row }) => row.original.events.toLocaleString(),
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) =>
      h(FleetAppStatus, {
        appStatus: getAppStatus(row.original.name),
      }),
  },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- UTable expects Nuxt UI table columns
const tableColumns = columns as any
</script>

<template>
  <div class="space-y-6">
    <AppBreadcrumbs :items="[{ label: 'Dashboard' }]" />

    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 class="font-display text-2xl font-semibold text-default">Dashboard</h1>
        <p class="mt-1 text-sm text-muted">
          Operations and the canonical last-30-days analytics snapshot.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton to="/analytics" icon="i-lucide-chart-column-big" class="cursor-pointer">
          Open Analytics
        </UButton>
        <UButton
          variant="outline"
          color="neutral"
          icon="i-lucide-refresh-cw"
          class="cursor-pointer"
          :loading="summaryLoading"
          @click="refreshDashboard"
        >
          Refresh
        </UButton>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AnalyticsStatCard label="Fleet Apps" :value="fleetApps.length" icon="i-lucide-grid-2x2" />
      <AnalyticsStatCard
        label="Apps Up"
        :value="upCount"
        icon="i-lucide-badge-check"
        icon-color="bg-emerald-500/10 text-emerald-600"
      />
      <AnalyticsStatCard
        label="Apps Down"
        :value="downCount"
        icon="i-lucide-siren"
        icon-color="bg-rose-500/10 text-rose-600"
      />
      <AnalyticsStatCard
        label="Provider Issues"
        :value="providerIssueCount"
        icon="i-lucide-shield-alert"
        icon-color="bg-amber-500/10 text-amber-600"
      />
    </div>

    <AnalyticsFleetBanner :summary="summary" :loading="summaryLoading" />

    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="font-semibold text-default">Fleet Matrix</h2>
            <p class="text-sm text-muted">
              Same metrics and provider states used on the analytics page.
            </p>
          </div>
          <UButton
            to="/fleet"
            variant="ghost"
            color="neutral"
            icon="i-lucide-arrow-right"
            class="cursor-pointer"
          >
            Operational Views
          </UButton>
        </div>
      </template>
      <UTable :data="tableData" :columns="tableColumns" />
    </UCard>
  </div>
</template>
