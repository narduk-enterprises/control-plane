<script setup lang="ts">
import type { AnalyticsProviderStatus, FleetAnalyticsSnapshot } from '~/types/analytics'
import type { FleetRegistryApp } from '~/types/fleet'
import {
  analyticsSurfaceHref,
  providerStatusColor,
  providerStatusText,
} from '~/utils/analyticsPresentation'

const props = defineProps<{
  apps: FleetRegistryApp[]
  snapshotMap: Record<string, FleetAnalyticsSnapshot | null>
  loading?: boolean
}>()

interface PosthogFleetRow {
  appName: string
  href: string
  hint: string
  status: AnalyticsProviderStatus
  statusLabel: string
  message: string
  events: number
  users: number
  pageviews: number
}

type SortState = false | 'asc' | 'desc'
type SortableHeaderColumn = {
  getIsSorted: () => SortState
  toggleSorting: (desc?: boolean) => void
}

function formatNumber(value: number | null | undefined) {
  return typeof value === 'number' ? value.toLocaleString() : '0'
}

const UButton = resolveComponent('UButton')
const sorting = ref([{ id: 'events', desc: true }])

const rows = computed<PosthogFleetRow[]>(() =>
  [...props.apps]
    .map((app) => {
      const snapshot = props.snapshotMap[app.name]
      const summary = snapshot?.posthog.metrics?.summary
      const status = snapshot?.posthog.status ?? 'error'

      return {
        appName: app.name,
        href: analyticsSurfaceHref('posthog', app.name),
        hint: snapshot?.app.posthogAppName
          ? `Project ${snapshot.app.posthogAppName}`
          : 'Using app slug fallback',
        status,
        statusLabel: providerStatusText(status),
        message: snapshot?.posthog.message ?? 'PostHog snapshot not loaded yet.',
        events: Number(summary?.event_count ?? 0),
        users: Number(summary?.unique_users ?? 0),
        pageviews: Number(summary?.pageviews ?? 0),
      }
    })
    .sort((left, right) => left.appName.localeCompare(right.appName)),
)

const healthyCount = computed(() => rows.value.filter((row) => row.status === 'healthy').length)

function sortableHeader(label: string) {
  return ({ column }: { column: SortableHeaderColumn }) => {
    const sortState = column.getIsSorted()

    return h(UButton, {
      color: 'neutral',
      variant: 'ghost',
      size: 'sm',
      class: 'font-semibold',
      label,
      icon:
        sortState === 'asc'
          ? 'i-lucide-arrow-up'
          : sortState === 'desc'
            ? 'i-lucide-arrow-down'
            : 'i-lucide-arrow-up-down',
      onClick: () => column.toggleSorting(sortState === 'asc'),
    })
  }
}

const columns = [
  {
    accessorKey: 'appName',
    header: sortableHeader('App'),
    meta: { class: { th: 'min-w-[15rem]', td: 'min-w-[15rem]' } },
  },
  {
    accessorKey: 'statusLabel',
    header: 'Status',
    enableSorting: false,
    meta: { class: { th: 'w-[8rem]', td: 'w-[8rem]' } },
  },
  {
    accessorKey: 'events',
    header: sortableHeader('Events'),
    meta: { class: { th: 'w-[7rem] text-right', td: 'w-[7rem] text-right tabular-nums' } },
  },
  {
    accessorKey: 'users',
    header: sortableHeader('Users'),
    meta: { class: { th: 'w-[7rem] text-right', td: 'w-[7rem] text-right tabular-nums' } },
  },
  {
    accessorKey: 'pageviews',
    header: sortableHeader('Pageviews'),
    meta: { class: { th: 'w-[8rem] text-right', td: 'w-[8rem] text-right tabular-nums' } },
  },
  {
    accessorKey: 'message',
    header: 'Provider Note',
    enableSorting: false,
    meta: {
      class: {
        th: 'hidden xl:table-cell min-w-[20rem]',
        td: 'hidden xl:table-cell max-w-[24rem] text-xs text-muted',
      },
    },
  },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- UTable expects @nuxt/ui column typing
const columnsForTable = columns as any
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2 text-sm text-muted">
      <UBadge color="primary" variant="subtle" size="sm">
        {{ healthyCount }}/{{ rows.length }} healthy
      </UBadge>
      <span>Product analytics stays isolated from acquisition metrics and indexing work.</span>
      <span class="text-xs text-muted">Click table headers to sort the fleet snapshot.</span>
    </div>

    <div class="overflow-hidden rounded-2xl border border-default bg-elevated/20">
      <div class="overflow-x-auto">
        <UTable
          v-model:sorting="sorting"
          :data="rows"
          :columns="columnsForTable"
          :loading="loading"
          :empty="loading ? 'Loading PostHog fleet state…' : 'No PostHog snapshots found.'"
          class="min-w-[760px] text-sm"
        >
          <template #appName-cell="{ row }">
            <div class="min-w-0">
              <NuxtLink
                :to="row.original.href"
                class="font-medium text-primary transition-colors hover:underline"
              >
                {{ row.original.appName }}
              </NuxtLink>
              <p class="mt-1 truncate text-xs text-muted" :title="row.original.hint">
                {{ row.original.hint }}
              </p>
            </div>
          </template>

          <template #statusLabel-cell="{ row }">
            <UBadge :color="providerStatusColor(row.original.status)" variant="soft" size="sm">
              {{ row.original.statusLabel }}
            </UBadge>
          </template>

          <template #events-cell="{ row }">
            <span class="font-medium text-default">
              {{ formatNumber(row.original.events) }}
            </span>
          </template>

          <template #users-cell="{ row }">
            <span class="font-medium text-default">
              {{ formatNumber(row.original.users) }}
            </span>
          </template>

          <template #pageviews-cell="{ row }">
            <span class="font-medium text-default">
              {{ formatNumber(row.original.pageviews) }}
            </span>
          </template>

          <template #message-cell="{ row }">
            <p class="truncate" :title="row.original.message">
              {{ row.original.message }}
            </p>
          </template>
        </UTable>
      </div>
    </div>
  </div>
</template>
