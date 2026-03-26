<script setup lang="ts">
import { FleetAppStatus, NuxtLink, UButton } from '#components'
import type { TableColumn } from '~/types/table'
import type { FleetRegistryApp } from '~/types/fleet'

useSeo({
  title: 'Dashboard',
  description: 'Operational dashboard for fleet health and quick navigation.',
  ogImage: {
    title: 'Narduk Control Plane Dashboard',
    description: 'Fleet operations.',
    icon: '⚙️',
  },
})
useWebPageSchema({
  name: 'Narduk Control Plane — Dashboard',
  description: 'Fleet operations dashboard.',
})

const { apps: fleetApps, getAppStatus, refreshStatuses, forceRefreshApps, isLoading } = useFleet()

async function refreshDashboard() {
  await Promise.all([refreshStatuses(), forceRefreshApps()])
}

const upCount = computed(
  () => fleetApps.value.filter((app) => getAppStatus(app.name)?.status === 'up').length,
)
const downCount = computed(
  () => fleetApps.value.filter((app) => getAppStatus(app.name)?.status === 'down').length,
)

const tableData = computed(() => fleetApps.value)

const columns: TableColumn<FleetRegistryApp>[] = [
  {
    accessorKey: 'name',
    header: 'App',
    cell: ({ row }) =>
      h(
        NuxtLink,
        {
          to: `/fleet/${row.original.name}`,
          class: 'font-medium text-primary hover:underline',
        },
        () => row.original.name,
      ),
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
          Fleet operations and uptime. Analytics live under Analytics in the nav.
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
          :loading="isLoading"
          @click="refreshDashboard"
        >
          Refresh
        </UButton>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <UCard class="p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Fleet apps</p>
        <p class="mt-1 font-display text-2xl font-semibold text-default">
          {{ fleetApps.length }}
        </p>
      </UCard>
      <UCard class="p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Up</p>
        <p class="mt-1 font-display text-2xl font-semibold text-success">
          {{ upCount }}
        </p>
      </UCard>
      <UCard class="p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Down</p>
        <p class="mt-1 font-display text-2xl font-semibold text-error">
          {{ downCount }}
        </p>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="font-semibold text-default">Fleet</h2>
            <p class="text-sm text-muted">Open an app for registry metadata and status tools.</p>
          </div>
          <UButton
            to="/fleet"
            variant="ghost"
            color="neutral"
            icon="i-lucide-arrow-right"
            class="cursor-pointer"
          >
            All apps
          </UButton>
        </div>
      </template>
      <UTable :data="tableData" :columns="tableColumns" />
    </UCard>
  </div>
</template>
