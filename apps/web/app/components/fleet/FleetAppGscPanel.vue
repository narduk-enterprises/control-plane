<script setup lang="ts">
import { h, resolveComponent, watch } from 'vue'
import type { TableColumn } from '~/types/table'
import type { GscDimension } from '~/composables/useFleetGscQuery'

type GscRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }

const props = defineProps<{ appName: string; active?: boolean }>()

const today = new Date().toISOString().split('T')[0]!
const start = new Date()
start.setDate(start.getDate() - 30)
const defaultStart = start.toISOString().split('T')[0]!

const startDate = ref(defaultStart)
const endDate = ref(today)
const dimension = ref<GscDimension>('query')

const params = computed(() => ({
  startDate: startDate.value,
  endDate: endDate.value,
  dimension: dimension.value,
}))

const { data, error, loading, load } = useFleetGscQuery(() => props.appName, params)

watch(() => props.active, (isActive) => {
  if (isActive && !data.value && !loading.value && !error.value) {
    load()
  }
}, { immediate: true })

const dimensions: { value: GscDimension; label: string }[] = [
  { value: 'query', label: 'Query' },
  { value: 'page', label: 'Page' },
  { value: 'device', label: 'Device' },
  { value: 'country', label: 'Country' },
  { value: 'searchAppearance', label: 'Search appearance' },
]

const sortKey = ref<'clicks' | 'impressions' | 'ctr' | 'position'>('clicks')
const sortDir = ref<'asc' | 'desc'>('desc')

function sortIndicator(key: 'clicks' | 'impressions' | 'ctr' | 'position') {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'desc' ? '↓' : '↑'
}

const tableRows = computed(() => {
  const rows = (data.value?.rows ?? []) as GscRow[]
  const key = sortKey.value
  const dir = sortDir.value
  return [...rows].sort((a, b) => {
    const va = a[key] ?? 0
    const vb = b[key] ?? 0
    return dir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
  })
})

const csvContent = computed(() => {
  const rows = tableRows.value
  const dim = data.value?.dimension ?? 'query'
  const header = [dim, 'Clicks', 'Impressions', 'CTR', 'Position'].join(',')
  const body = rows
    .map((r) => {
      const key = (r.keys?.[0] ?? '').replaceAll('"', '""')
      return [`"${key}"`, r.clicks ?? 0, r.impressions ?? 0, (r.ctr ?? 0).toFixed(2), (r.position ?? 0).toFixed(1)].join(',')
    })
    .join('\n')
  return [header, body].join('\n')
})

const UButton = resolveComponent('UButton')

const gscColumns = computed<TableColumn<GscRow>[]>(() => [
  {
    id: 'key',
    header: data.value?.dimension ?? 'query',
    meta: { class: { td: 'max-w-[200px] truncate' } },
    cell: ({ row }) => row.original.keys?.[0] ?? '—',
  },
  {
    accessorKey: 'clicks',
    header: () => h(UButton, {
      variant: 'ghost',
      color: 'neutral',
      label: `Clicks ${sortIndicator('clicks')}`,
      class: '-mx-2.5 cursor-pointer font-medium text-muted hover:text-default',
      onClick: () => setSort('clicks'),
    }),
    cell: ({ row }) => row.original.clicks ?? 0,
  },
  {
    accessorKey: 'impressions',
    header: () => h(UButton, {
      variant: 'ghost',
      color: 'neutral',
      label: `Impressions ${sortIndicator('impressions')}`,
      class: '-mx-2.5 cursor-pointer font-medium text-muted hover:text-default',
      onClick: () => setSort('impressions'),
    }),
    cell: ({ row }) => row.original.impressions ?? 0,
  },
  {
    accessorKey: 'ctr',
    header: () => h(UButton, {
      variant: 'ghost',
      color: 'neutral',
      label: `CTR ${sortIndicator('ctr')}`,
      class: '-mx-2.5 cursor-pointer font-medium text-muted hover:text-default',
      onClick: () => setSort('ctr'),
    }),
    cell: ({ row }) => `${((row.original.ctr ?? 0) * 100).toFixed(2)}%`,
  },
  {
    accessorKey: 'position',
    header: () => h(UButton, {
      variant: 'ghost',
      color: 'neutral',
      label: `Position ${sortIndicator('position')}`,
      class: '-mx-2.5 cursor-pointer font-medium text-muted hover:text-default',
      onClick: () => setSort('position'),
    }),
    cell: ({ row }) => (row.original.position ?? 0).toFixed(1),
  },
])

function copyCsv() {
  if (!csvContent.value) return
  navigator.clipboard.writeText(csvContent.value)
}

async function onLoad() {
  await load()
}

function setSort(key: 'clicks' | 'impressions' | 'ctr' | 'position') {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  else sortKey.value = key
  sortDir.value = 'desc'
}

const formattedCrawledAs = computed(() => {
  const crawledAs = data.value?.inspection?.indexStatusResult?.crawledAs
  return crawledAs ? crawledAs.replace('CRAWLED_AS_', '') : ''
})

// Cast for UTable columns prop (expects TanStack type from layer; we use local TableColumn)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- UTable expects @nuxt/ui TableColumn, not our local type
const gscColumnsForTable = computed(() => gscColumns.value as any)

const formattedLastCrawlTime = computed(() => {
  const time = data.value?.inspection?.indexStatusResult?.lastCrawlTime
  return time ? new Date(time).toLocaleString() : ''
})

</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-3">
      <UFormField label="Start date">
        <UInput v-model="startDate" type="date" class="min-w-40" />
      </UFormField>
      <UFormField label="End date">
        <UInput v-model="endDate" type="date" class="min-w-40" />
      </UFormField>
      <UFormField label="Dimension">
        <USelect
          v-model="dimension"
          :items="dimensions"
          value-attribute="value"
          class="min-w-40"
        />
      </UFormField>
      <UButton
        :loading="loading"
        class="cursor-pointer"
        @click="onLoad"
      >
        Load
      </UButton>
    </div>

    <div v-if="error" class="rounded-lg border border-error/30 bg-error/5 p-4">
      <p class="text-sm font-medium text-error">GSC error</p>
      <p class="mt-1 text-sm text-muted">{{ error.data?.message || error?.message }}</p>
    </div>

    <div v-else-if="data && data.rows?.length" class="space-y-4">
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <UCard class="shadow-sm">
          <p class="text-sm font-medium text-muted">Total Clicks</p>
          <p class="mt-1 text-2xl font-semibold text-default">{{ (data.totals?.clicks ?? 0).toLocaleString() }}</p>
        </UCard>
        <UCard class="shadow-sm">
          <p class="text-sm font-medium text-muted">Total Impressions</p>
          <p class="mt-1 text-2xl font-semibold text-default">{{ (data.totals?.impressions ?? 0).toLocaleString() }}</p>
        </UCard>
        <UCard class="shadow-sm">
          <p class="text-sm font-medium text-muted">Average CTR</p>
          <p class="mt-1 text-2xl font-semibold text-default">{{ ((data.totals?.ctr ?? 0) * 100).toFixed(2) }}%</p>
        </UCard>
        <UCard class="shadow-sm">
          <p class="text-sm font-medium text-muted">Average Position</p>
          <p class="mt-1 text-2xl font-semibold text-default">{{ (data.totals?.position ?? 0).toFixed(1) }}</p>
        </UCard>
      </div>

      <div v-if="data.inspection?.indexStatusResult" class="rounded-lg border border-default p-4">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <UIcon 
                :name="data.inspection.indexStatusResult.verdict === 'PASS' ? 'i-lucide-check-circle' : 'i-lucide-alert-circle'" 
                :class="data.inspection.indexStatusResult.verdict === 'PASS' ? 'text-success' : 'text-warning'"
                class="size-5"
              />
              <p class="font-medium text-default">Index Status</p>
            </div>
            <p class="mt-1 text-sm text-muted">
              {{ data.inspection.indexStatusResult.coverageState || 'Unknown coverage state' }}
            </p>
            <div class="mt-2 flex flex-col gap-1 text-xs text-muted sm:flex-row sm:items-center sm:gap-4">
              <span v-if="formattedLastCrawlTime">
                Last crawled: {{ formattedLastCrawlTime }}
              </span>
              <span v-if="formattedCrawledAs">
                Agent: {{ formattedCrawledAs }}
              </span>
            </div>
          </div>
          <UButton 
            v-if="data.inspection.inspectionResultLink"
            :to="data.inspection.inspectionResultLink"
            target="_blank"
            color="neutral"
            variant="ghost"
            icon="i-lucide-external-link"
            size="sm"
          >
            View in GSC
          </UButton>
        </div>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <p class="text-sm text-muted">
            {{ data.startDate }} → {{ data.endDate }} ({{ data.dimension }}) · {{ data.rows.length }} rows
          </p>
          <UButton
            variant="outline"
            size="xs"
            class="cursor-pointer"
            icon="i-lucide-copy"
            @click="copyCsv"
          >
            Copy CSV
          </UButton>
        </div>
        <div class="overflow-x-auto rounded-lg border border-default">
          <UTable
            :data="tableRows"
            :columns="gscColumnsForTable"
            class="text-sm"
          />
        </div>
      </div>
    </div>

    <div v-else-if="data && !data.rows?.length" class="rounded-lg border border-dashed border-default p-6 text-center">
      <UIcon name="i-lucide-bar-chart-3" class="mx-auto size-10 text-muted" />
      <p class="mt-2 text-sm font-medium text-default">No data</p>
      <p class="mt-1 text-sm text-muted">No Search Console data for this period. Try a different range or dimension.</p>
    </div>

    <div v-else class="rounded-lg border border-dashed border-default p-6 text-center">
      <UIcon name="i-lucide-bar-chart-3" class="mx-auto size-10 text-muted" />
      <p class="mt-2 text-sm font-medium text-default">Load GSC data</p>
      <p class="mt-1 text-sm text-muted">Choose dates and dimension, then click Load.</p>
    </div>
  </div>
</template>
