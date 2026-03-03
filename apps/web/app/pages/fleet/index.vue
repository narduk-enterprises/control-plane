<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '~/types/table'

useSeo({
  title: 'Fleet',
  description: 'Fleet apps — GSC, PostHog, IndexNow per app.',
})
useWebPageSchema({
  name: 'Narduk Control Plane — Fleet',
  description: 'Fleet apps list.',
})

type FleetApp = { name: string; url: string; dopplerProject: string }

const { apps, refreshApps } = useFleetDashboard()
const searchQuery = ref('')
const fleetApps = computed(() => apps.value ?? [])
const filteredApps = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return fleetApps.value
  return fleetApps.value.filter(
    (app) =>
      app.name.toLowerCase().includes(q) ||
      app.url.toLowerCase().includes(q) ||
      app.dopplerProject.toLowerCase().includes(q),
  )
})
const hasApps = computed(() => fleetApps.value.length > 0)
const hasResults = computed(() => filteredApps.value.length > 0)

const NuxtLink = resolveComponent('NuxtLink')
const UButton = resolveComponent('UButton')

const fleetColumns: TableColumn<FleetApp>[] = [
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
    meta: { class: { th: 'hidden md:table-cell', td: 'max-w-[200px] truncate text-muted hidden md:table-cell' } },
    cell: ({ row }) => row.original.url,
  },
  {
    id: 'actions',
    header: 'Actions',
    meta: { class: { th: 'text-right', td: 'text-right' } },
    cell: ({ row }) => {
      const app = row.original
      return h('div', { class: 'flex items-center justify-end gap-1' }, [
        h(UButton, {
          to: `/fleet/${app.name}`,
          size: 'xs',
          variant: 'ghost',
          color: 'neutral',
          icon: 'i-lucide-bar-chart-3',
          'aria-label': 'GSC',
          class: 'cursor-pointer',
        }),
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
        }),
      ])
    },
    enableSorting: false,
  },
]

const fleetCountLabel = computed(() => {
  const n = fleetApps.value.length
  return n === 1 ? '1 app' : `${n} apps`
})

const breadcrumbItems = computed(() => [
  { label: 'Dashboard', to: '/' },
  { label: 'Fleet' },
])

// Cast for UTable columns prop (expects TanStack type from layer; we use local TableColumn)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- UTable expects @nuxt/ui TableColumn, not our local type
const fleetColumnsForTable = fleetColumns as any
</script>

<template>
  <div>
    <AppBreadcrumbs :items="breadcrumbItems" />
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="font-display text-2xl font-semibold text-default">
          Fleet
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ fleetCountLabel }} — open GSC, PostHog, or IndexNow per app
        </p>
      </div>
      <UButton
        variant="outline"
        color="neutral"
        icon="i-lucide-refresh-cw"
        class="cursor-pointer"
        @click="refreshApps()"
      >
        Refresh
      </UButton>
    </div>

    <UCard v-if="hasApps">
      <template #header>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 class="font-semibold text-default">Apps</h2>
          <UInput
            v-model="searchQuery"
            placeholder="Search by name or URL..."
            class="max-w-xs"
            icon="i-lucide-search"
          />
        </div>
      </template>
      <div v-if="hasResults" class="overflow-x-auto">
        <UTable
          :data="filteredApps"
          :columns="fleetColumnsForTable"
        />
      </div>
      <div v-else class="rounded-lg border border-dashed border-default p-8 text-center">
        <UIcon name="i-lucide-search-x" class="mx-auto size-10 text-muted" />
        <p class="mt-2 text-sm font-medium text-default">No matches</p>
        <p class="mt-1 text-sm text-muted">Try a different search.</p>
      </div>
    </UCard>

    <UCard v-else>
      <div class="rounded-lg border border-dashed border-default p-8 text-center">
        <UIcon name="i-lucide-inbox" class="mx-auto size-10 text-muted" />
        <p class="mt-2 text-sm font-medium text-default">No fleet apps</p>
        <p class="mt-1 text-sm text-muted">Ensure you are authenticated. Fleet list comes from the registry.</p>
      </div>
    </UCard>
  </div>
</template>
