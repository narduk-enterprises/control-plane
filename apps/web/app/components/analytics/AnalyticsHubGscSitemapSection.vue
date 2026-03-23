<script setup lang="ts">
export interface GscSitemapHistoryRow {
  id: string
  app: string
  submittedAt: string
  ok: boolean
  trigger: string
  sitemapUrl: string | null
  gscProperty: string | null
  message: string | null
}

const props = defineProps<{
  gscSitemapSummary: {
    appsWithSubmission?: number
    totalFleetSize?: number
    totalSubmissions?: number
  } | null
  gscSitemapSubmitting: boolean
  historyRefreshKey?: number
}>()

const emit = defineEmits<{
  (e: 'batchSubmit'): void
}>()

const {
  data: historyRows,
  pending: historyPending,
  refresh: refreshHistory,
  error: historyError,
} = useLazyFetch<GscSitemapHistoryRow[]>('/api/fleet/gsc-sitemap/history', {
  query: { limit: 100 },
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
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
    accessorKey: 'submittedAt',
    header: 'Time',
    meta: { class: { td: 'whitespace-nowrap' } },
    cell: ({ row }: { row: { original: GscSitemapHistoryRow } }) =>
      new Date(row.original.submittedAt).toLocaleString(),
  },
  {
    accessorKey: 'app',
    header: 'App',
    cell: ({ row }: { row: { original: GscSitemapHistoryRow } }) => row.original.app,
  },
  {
    accessorKey: 'trigger',
    header: 'Source',
    meta: { class: { th: 'hidden sm:table-cell', td: 'hidden sm:table-cell' } },
    cell: ({ row }: { row: { original: GscSitemapHistoryRow } }) => row.original.trigger,
  },
  {
    accessorKey: 'ok',
    header: 'Result',
    cell: ({ row }: { row: { original: GscSitemapHistoryRow } }) =>
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
    accessorKey: 'message',
    header: 'Note',
    meta: { class: { td: 'max-w-[200px] truncate text-muted sm:max-w-xs' } },
    cell: ({ row }: { row: { original: GscSitemapHistoryRow } }) => row.original.message ?? '—',
  },
]
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="gscSitemapSummary"
      class="flex flex-wrap items-center gap-3 rounded-xl border border-default/60 bg-elevated/30 px-4 py-3"
    >
      <div
        class="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2"
      >
        <div class="flex items-center gap-2 text-sm text-muted">
          <UIcon name="i-lucide-map" class="size-4 shrink-0 text-primary" />
          <span>Search Console sitemaps</span>
          <UBadge
            variant="subtle"
            size="sm"
            :color="(gscSitemapSummary.appsWithSubmission ?? 0) > 0 ? 'success' : 'neutral'"
          >
            {{ gscSitemapSummary.appsWithSubmission ?? 0 }}/{{
              gscSitemapSummary.totalFleetSize ?? 0
            }}
            submitted from here
          </UBadge>
          <span class="hidden sm:inline">
            {{ gscSitemapSummary.totalSubmissions?.toLocaleString() ?? 0 }} total submits
          </span>
        </div>
        <p class="text-xs leading-snug text-muted sm:max-w-xl">
          Registers <code class="text-xs">/sitemap.xml</code> with Google for each app. The hourly
          cron resubmits automatically when the sitemap body changes (SHA-256). Manual “Submit all”
          forces a GSC ping for every app. Requires the service account to have the
          <span class="font-medium text-default">webmasters</span> scope (not readonly).
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
          icon="i-lucide-upload-cloud"
          class="cursor-pointer"
          :loading="gscSitemapSubmitting"
          @click="emit('batchSubmit')"
        >
          Submit all
        </UButton>
      </div>
    </div>
    <p v-else class="text-sm text-muted">Loading GSC sitemap summary…</p>

    <UCard class="overflow-hidden">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-history" class="text-primary" />
          <h3 class="text-sm font-medium">Submit history</h3>
          <span class="text-xs text-muted">(last 100)</span>
        </div>
      </template>
      <div v-if="historyError" class="px-4 py-3 text-sm text-error">Could not load history.</div>
      <div v-else-if="historyPending && !historyRows?.length" class="px-4 py-6 text-sm text-muted">
        Loading…
      </div>
      <div v-else-if="!historyRows?.length" class="px-4 py-6 text-sm text-muted">
        No submissions logged yet. Cron and dashboard submits appear here.
      </div>
      <div v-else class="max-h-[min(28rem,50vh)] overflow-auto -mx-4 sm:mx-0">
        <!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -- UTable columns -->
        <UTable :data="historyRows" :columns="historyColumns as any" class="text-xs" />
      </div>
    </UCard>
  </div>
</template>
