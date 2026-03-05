<script setup lang="ts">
import { h } from 'vue'
import { NuxtLink, UButton, FleetAppStatus, FleetAppPosthogStats, UTooltip, UIcon } from '#components'
import type { TableColumn } from '~/types/table'
import type { FleetApp } from '~/composables/useFleet'

useSeo({
  title: 'Dashboard',
  description: 'Narduk Control Plane — fleet overview and quick actions.',
  ogImage: { title: 'Narduk Control Plane Dashboard', description: 'Fleet dashboard.', icon: '⚙️' },
})
useWebPageSchema({
  name: 'Narduk Control Plane — Dashboard',
  description: 'Fleet dashboard overview.',
})

const { 
  apps: fleetApps, 
  getAppStatus: getStatus, 
  refreshStatuses, 
  refreshApps, 
  refreshPosthog,
  forceRefreshAll,
  posthogSummary, 
  isLoading 
} = useFleet()

const fleetCount = computed(() => fleetApps.value.length)
const hasFleetApps = computed(() => fleetCount.value > 0)
const lastRefresh = ref<Date | null>(null)

const isCheckingAll = ref(false)
async function checkAllStatuses() {
  if (!fleetApps.value.length) return
  isCheckingAll.value = true
  await refreshStatuses()
  isCheckingAll.value = false
}

// Pagination logic
const page = ref(1)
const itemsPerPage = 20
const paginatedApps = computed(() => {
  const sortedApps = [...fleetApps.value].sort((a, b) => a.name.localeCompare(b.name))
  const start = (page.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return sortedApps.slice(start, end)
})

const dashboardColumns: TableColumn<FleetApp>[] = [
  {
    accessorKey: 'name',
    header: 'App',
    cell: ({ row }) => {
      const app = row.original
      return h(NuxtLink, {
        to: `/fleet/${app.name}`,
        class: 'font-medium text-primary hover:underline cursor-pointer',
      }, () => app.name)
    },
  },
  {
    accessorKey: 'url',
    header: 'URL',
    meta: { class: { th: 'hidden md:table-cell', td: 'max-w-[200px] truncate hidden md:table-cell' } },
    cell: ({ row }) => {
      return h('a', {
        href: row.original.url,
        target: '_blank',
        rel: 'noopener',
        class: 'text-muted hover:text-primary transition-colors hover:underline flex items-center gap-1',
      }, [
        row.original.url.replace(/^https?:\/\//, ''),
        h(UIcon, { name: 'i-lucide-external-link', class: 'size-3 opacity-50' }),
      ])
    },
  },
  {
    id: 'status',
    header: 'Status',
    meta: { class: { th: 'hidden sm:table-cell', td: 'hidden sm:table-cell' } },
    cell: ({ row }) => {
      return h(FleetAppStatus, { appStatus: getStatus(row.original.name) })
    },
    enableSorting: false,
  },
  {
    id: 'posthog',
    header: 'PostHog (30d)',
    cell: ({ row }) => h(FleetAppPosthogStats, {
      appName: row.original.name,
      stats: posthogSummary.value?.[row.original.posthogAppName ?? row.original.name] ?? null,
      loading: isLoading.value,
      loaded: !isLoading.value,
    }),
    enableSorting: false,
  },
  {
    id: 'actions',
    header: 'Actions',
    meta: { class: { th: 'text-right', td: 'text-right' } },
    cell: ({ row }) => {
      const app = row.original
      return h('div', { class: 'flex items-center justify-end gap-1' }, [
        h(UTooltip, { text: 'View GSC Data' }, () => [
          h(UButton, {
            to: `/fleet/${app.name}`,
            size: 'xs',
            variant: 'ghost',
            color: 'neutral',
            icon: 'i-lucide-bar-chart-3',
            'aria-label': 'GSC',
            class: 'cursor-pointer',
          })
        ]),
        h(UTooltip, { text: 'Open App in Browser' }, () => [
          h(UButton, {
            to: app.url,
            target: '_blank',
            rel: 'noopener',
            size: 'xs',
            variant: 'ghost',
            color: 'neutral',
            icon: 'i-lucide-external-link',
            'aria-label': 'Open app',
            class: 'cursor-pointer',
          })
        ]),
      ])
    },
    enableSorting: false,
  },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const columnsForTable = dashboardColumns as any

async function onRefresh() {
  await forceRefreshAll()
  lastRefresh.value = new Date()
}
</script>

<template>
  <div>
    <AppBreadcrumbs :items="[{ label: 'Dashboard' }]" />
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="font-display text-2xl font-semibold text-default">
          Dashboard
        </h1>
        <p class="mt-1 text-sm text-muted">
          Fleet overview and quick actions
        </p>
      </div>
      <UButton
        variant="outline"
        color="neutral"
        icon="i-lucide-refresh-cw"
        class="cursor-pointer shrink-0"
        @click="onRefresh"
      >
        Refresh
      </UButton>
    </div>

    <!-- KPI cards -->
    <ClientOnly>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <UCard class="cursor-default transition-transform hover:-translate-y-1 hover:shadow-elevated duration-300">
          <div class="flex items-center gap-4">
            <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UIcon name="i-lucide-grid-3x3" class="size-6" />
            </div>
            <div>
              <p class="text-sm font-medium text-muted">Fleet apps</p>
              <p class="text-2xl font-semibold text-default">
                {{ fleetCount }}
              </p>
            </div>
          </div>
        </UCard>
        <UCard class="cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-elevated duration-300" @click="navigateTo('/fleet')">
          <div class="flex items-center gap-4">
            <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UIcon name="i-lucide-bar-chart-3" class="size-6" />
            </div>
            <div>
              <p class="text-sm font-medium text-muted">GSC</p>
              <p class="text-sm text-default">View per app</p>
            </div>
          </div>
        </UCard>
        <UCard class="cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-elevated duration-300" @click="navigateTo('/fleet')">
          <div class="flex items-center gap-4">
            <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UIcon name="i-lucide-users" class="size-6" />
            </div>
            <div>
              <p class="text-sm font-medium text-muted">PostHog</p>
              <p class="text-sm text-default">Events &amp; users</p>
            </div>
          </div>
        </UCard>
        <UCard class="cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-elevated duration-300" @click="navigateTo('/indexing')">
          <div class="flex items-center gap-4">
            <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UIcon name="i-lucide-search" class="size-6" />
            </div>
            <div>
              <p class="text-sm font-medium text-muted">Indexing</p>
              <p class="text-sm text-default">Submit URLs</p>
            </div>
          </div>
        </UCard>
      </div>
      <template #fallback>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          <USkeleton v-for="i in 4" :key="i" class="h-28 w-full rounded-xl" />
        </div>
      </template>
    </ClientOnly>

    <!-- Quick actions -->
    <div class="flex flex-wrap items-center gap-3 mb-8">
      <UButton
        to="/fleet"
        variant="outline"
        color="neutral"
        class="cursor-pointer"
        icon="i-lucide-grid-3x3"
      >
        Browse fleet
      </UButton>
      <UButton
        to="/indexing"
        variant="outline"
        color="neutral"
        class="cursor-pointer"
        icon="i-lucide-send"
      >
        Submit URL to Google
      </UButton>
      <UButton
        to="/github"
        variant="outline"
        color="neutral"
        class="cursor-pointer"
        icon="i-lucide-github"
      >
        View GitHub Repos
      </UButton>
      <UButton
        to="/settings"
        variant="outline"
        color="neutral"
        class="cursor-pointer"
        icon="i-lucide-settings"
      >
        Settings
      </UButton>
    </div>

    <!-- Fleet apps -->
    <div class="w-full">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <h2 class="font-semibold text-default">Fleet apps</h2>
                <UBadge variant="subtle" color="primary" size="sm" class="rounded-full px-2" v-if="fleetCount">{{ fleetCount }}</UBadge>
              </div>
              <div class="flex flex-wrap items-center justify-end gap-2">
                <UButton
                  variant="soft"
                  size="xs"
                  icon="i-lucide-activity"
                  class="cursor-pointer"
                  :loading="isCheckingAll"
                  @click="checkAllStatuses"
                >
                  Check All
                </UButton>
                <UButton
                  variant="outline"
                  color="neutral"
                  size="xs"
                  icon="i-lucide-refresh-cw"
                  class="cursor-pointer"
                  :loading="isLoading"
                  @click="onRefresh"
                >
                  Refresh All Data
                </UButton>
                <UButton
                  to="/fleet"
                  variant="ghost"
                  size="sm"
                  class="cursor-pointer"
                >
                  View all
                </UButton>
              </div>
            </div>
          </template>
          <div v-if="hasFleetApps" class="flex flex-col gap-4">
            <div class="overflow-x-auto rounded-lg border border-default">
              <UTable
                :data="paginatedApps"
                :columns="columnsForTable"
                class="min-w-full"
              />
            </div>
            <div v-if="fleetCount > itemsPerPage" class="flex justify-end">
              <UPagination
                v-model:page="page"
                :total="fleetCount"
                :items-per-page="itemsPerPage"
              />
            </div>
          </div>
          <div v-else class="rounded-lg border border-dashed border-default p-8 text-center bg-elevated/50">
            <UIcon name="i-lucide-inbox" class="mx-auto size-12 text-muted/50 mb-3" />
            <p class="text-base font-medium text-default">No fleet apps configured</p>
            <p class="mt-1 mb-4 text-sm text-muted">Fleet apps are configured inside the central registry.</p>
            <UButton to="/settings" variant="outline" color="neutral" icon="i-lucide-settings">
              Go to Settings
            </UButton>
          </div>
        </UCard>
    </div>

    <div v-if="lastRefresh" class="mt-6 flex justify-end">
      <p class="text-xs text-muted flex items-center gap-1.5">
        <UIcon name="i-lucide-clock" class="size-3" />
        Last refreshed: <NuxtTime :datetime="lastRefresh" relative class="font-medium" />
      </p>
    </div>
  </div>
</template>
