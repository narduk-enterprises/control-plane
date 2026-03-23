<script setup lang="ts">
import { getNuxtCachedData, markNuxtFetchedAt } from '~/utils/fetchCache'

export interface IndexnowHistoryRow {
  id: string
  app: string
  pingedAt: string
  ok: boolean
  downstreamStatus: number | null
  urlCount: number | null
  targetUrl: string | null
  message: string | null
}

const props = defineProps<{
  indexnowSummary: {
    appsWithIndexnow?: number
    totalFleetSize?: number
    totalSubmissions?: number
  } | null
  indexnowSubmitting: boolean
  /** Increment after batch submit to reload history. */
  historyRefreshKey?: number
}>()

const emit = defineEmits<{
  (e: 'batchSubmit'): void
}>()

const nuxtApp = useNuxtApp()

const {
  data: historyRows,
  pending: historyPending,
  refresh: refreshHistory,
  error: historyError,
} = useLazyFetch<IndexnowHistoryRow[]>('/api/fleet/indexnow/history', {
  key: 'fleet-indexnow-history',
  server: false,
  immediate: false,
  query: { limit: 100 },
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
  getCachedData(key, nuxtApp) {
    return getNuxtCachedData(key, nuxtApp)
  },
  transform(input) {
    markNuxtFetchedAt(nuxtApp, 'fleet-indexnow-history')
    return input
  },
})

watch(
  () => props.historyRefreshKey,
  () => {
    void refreshHistory()
  },
)

onMounted(() => {
  void refreshHistory()
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- UTable cell row typing
const historyColumns: any[] = [
  {
    accessorKey: 'pingedAt',
    header: 'Time',
    meta: { class: { td: 'whitespace-nowrap' } },
    cell: ({ row }: { row: { original: IndexnowHistoryRow } }) =>
      new Date(row.original.pingedAt).toLocaleString(),
  },
  {
    accessorKey: 'app',
    header: 'App',
    cell: ({ row }: { row: { original: IndexnowHistoryRow } }) => row.original.app,
  },
  {
    accessorKey: 'ok',
    header: 'Result',
    cell: ({ row }: { row: { original: IndexnowHistoryRow } }) =>
      h(
        'span',
        {
          class: row.original.ok
            ? 'rounded-md bg-success/15 px-1.5 py-0.5 font-medium text-success'
            : 'rounded-md bg-error/15 px-1.5 py-0.5 font-medium text-error',
        },
        row.original.ok ? 'OK' : 'Fail',
      ),
  },
  {
    accessorKey: 'downstreamStatus',
    header: 'HTTP',
    meta: { class: { th: 'hidden sm:table-cell', td: 'hidden sm:table-cell' } },
    cell: ({ row }: { row: { original: IndexnowHistoryRow } }) =>
      row.original.downstreamStatus ?? '—',
  },
  {
    accessorKey: 'urlCount',
    header: 'URLs',
    meta: { class: { th: 'hidden md:table-cell', td: 'hidden md:table-cell' } },
    cell: ({ row }: { row: { original: IndexnowHistoryRow } }) =>
      row.original.urlCount != null ? String(row.original.urlCount) : '—',
  },
  {
    accessorKey: 'message',
    header: 'Note',
    meta: { class: { td: 'max-w-[200px] truncate text-muted sm:max-w-xs' } },
    cell: ({ row }: { row: { original: IndexnowHistoryRow } }) => row.original.message ?? '—',
  },
]
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="indexnowSummary"
      class="flex flex-wrap items-center gap-3 rounded-xl border border-default/60 bg-elevated/30 px-4 py-3"
    >
      <div
        class="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2"
      >
        <div class="flex items-center gap-2 text-sm text-muted">
          <UIcon name="i-lucide-send" class="size-4 shrink-0 text-primary" />
          <span>IndexNow</span>
          <UBadge
            variant="subtle"
            size="sm"
            :color="(indexnowSummary.appsWithIndexnow ?? 0) > 0 ? 'success' : 'neutral'"
          >
            {{ indexnowSummary.appsWithIndexnow ?? 0 }}/{{ indexnowSummary.totalFleetSize ?? 0 }}
            pinged from here
          </UBadge>
          <span class="hidden sm:inline">
            {{ indexnowSummary.totalSubmissions?.toLocaleString() ?? 0 }} total pings
          </span>
        </div>
        <p class="text-xs leading-snug text-muted sm:max-w-xl">
          Search engines acknowledge pings over HTTP only—no traffic stats. This count is pings
          recorded by the control plane, not Doppler or on-site submits alone.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          size="xs"
          variant="outline"
          color="neutral"
          icon="i-lucide-refresh-cw"
          class="cursor-pointer"
          :loading="historyPending"
          @click="refreshHistory()"
        >
          Refresh log
        </UButton>
        <UButton
          size="xs"
          variant="soft"
          color="primary"
          icon="i-lucide-send"
          class="cursor-pointer"
          :loading="indexnowSubmitting"
          @click="emit('batchSubmit')"
        >
          Submit All
        </UButton>
      </div>
    </div>
    <p v-else class="text-sm text-muted">Loading IndexNow summary…</p>

    <UCard class="overflow-hidden">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-history" class="text-primary" />
          <h3 class="text-sm font-medium">Ping history</h3>
          <span class="text-xs text-muted">(last 100 fleet proxy attempts)</span>
        </div>
      </template>
      <div v-if="historyError" class="px-4 py-3 text-sm text-error">Could not load history.</div>
      <div v-else-if="historyPending && !historyRows?.length" class="px-4 py-6 text-sm text-muted">
        Loading…
      </div>
      <div v-else-if="!historyRows?.length" class="px-4 py-6 text-sm text-muted">
        No pings logged yet. Successful and failed attempts from this dashboard appear here.
      </div>
      <div v-else class="max-h-[min(28rem,50vh)] overflow-auto -mx-4 sm:mx-0">
        <!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -- UTable columns -->
        <UTable :data="historyRows" :columns="historyColumns as any" class="text-xs" />
      </div>
    </UCard>
  </div>
</template>
