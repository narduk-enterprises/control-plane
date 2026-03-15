<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '~/types/table'
import type { GscDimension } from '~/composables/useFleetGscQuery'
import type { DatePreset } from '~/composables/useAnalyticsDateRange'

type GscRow = {
  keys?: string[]
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
}

const route = useRoute()
const appName = computed(() => (route.params.app as string) ?? '')

useSeo({
  title: `Search — ${appName.value} — Analytics`,
  description: `GSC search performance for ${appName.value}: time series, dimensions, URL inspection.`,
})
useWebPageSchema({
  name: 'GSC Search Deep Dive',
  description: 'Search Console performance with time series and dimension tables.',
})

const { preset, startDate, endDate, presetOptions, presetLabel, setPreset } =
  useAnalyticsDateRange('7d')
const force = ref(false)
const dimension = ref<GscDimension>('query')

const {
  data: seriesData,
  loading: seriesLoading,
  load: loadSeries,
} = useFleetGscSeries(appName, startDate, endDate, { force })

const gscParams = computed(() => ({
  startDate: startDate.value,
  endDate: endDate.value,
  dimension: dimension.value,
  force: force.value,
}))
const { data: gscData, loading: gscLoading, load: loadGsc } = useFleetGscQuery(appName, gscParams)

function loadAll() {
  if (!appName.value) return
  loadSeries()
  loadGsc()
}

watch(
  [appName, startDate, endDate],
  () => {
    loadAll()
  },
  { immediate: true },
)
watch(dimension, () => {
  loadGsc()
})

async function onForceRefresh() {
  force.value = true
  try {
    await loadAll()
  } finally {
    force.value = false
  }
}

function onPresetChange(p: string) {
  setPreset(p as DatePreset)
}

const clicksTimeSeries = computed(() =>
  (seriesData.value?.timeSeries ?? []).map((d) => ({ date: d.date, value: d.clicks })),
)
const impressionsTimeSeries = computed(() =>
  (seriesData.value?.timeSeries ?? []).map((d) => ({ date: d.date, value: d.impressions })),
)

type SortKey = 'key' | 'clicks' | 'impressions' | 'ctr' | 'position'
const sortKey = ref<SortKey>('clicks')
const sortDir = ref<'asc' | 'desc'>('desc')

function sortIndicator(key: SortKey) {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'desc' ? '↓' : '↑'
}

const tableRows = computed(() => {
  const rows = (gscData.value?.rows ?? []) as GscRow[]
  const key = sortKey.value
  const dir = sortDir.value
  return [...rows].sort((a, b) => {
    if (key === 'key') {
      const va = a.keys?.[0] ?? ''
      const vb = b.keys?.[0] ?? ''
      return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    }
    const va = a[key] ?? 0
    const vb = b[key] ?? 0
    return dir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
  })
})

const csvContent = computed(() => {
  const rows = tableRows.value
  const dim = gscData.value?.dimension ?? 'query'
  const header = [dim, 'Clicks', 'Impressions', 'CTR', 'Position'].join(',')
  const body = rows
    .map((r) => {
      const key = (r.keys?.[0] ?? '').replaceAll('"', '""')
      return [
        `"${key}"`,
        r.clicks ?? 0,
        r.impressions ?? 0,
        (r.ctr ?? 0).toFixed(2),
        (r.position ?? 0).toFixed(1),
      ].join(',')
    })
    .join('\n')
  return [header, body].join('\n')
})

const UButton = resolveComponent('UButton')

const gscColumns = computed<TableColumn<GscRow>[]>(() => [
  {
    id: 'key',
    header: () =>
      h(UButton, {
        variant: 'ghost',
        color: 'neutral',
        label: `${gscData.value?.dimension ?? 'query'} ${sortIndicator('key')}`,
        class: '-mx-2.5 cursor-pointer font-medium text-muted hover:text-default',
        onClick: () => setSort('key'),
      }),
    meta: { class: { td: 'max-w-[200px] truncate' } },
    cell: ({ row }) => row.original.keys?.[0] ?? '—',
  },
  {
    accessorKey: 'clicks',
    header: () =>
      h(UButton, {
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
    header: () =>
      h(UButton, {
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
    header: () =>
      h(UButton, {
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
    header: () =>
      h(UButton, {
        variant: 'ghost',
        color: 'neutral',
        label: `Position ${sortIndicator('position')}`,
        class: '-mx-2.5 cursor-pointer font-medium text-muted hover:text-default',
        onClick: () => setSort('position'),
      }),
    cell: ({ row }) => (row.original.position ?? 0).toFixed(1),
  },
])

function setSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'key' ? 'asc' : 'desc'
  }
}

function copyCsv() {
  if (!csvContent.value) return
  navigator.clipboard.writeText(csvContent.value)
}

const dimensions: { value: GscDimension; label: string }[] = [
  { value: 'query', label: 'Query' },
  { value: 'page', label: 'Page' },
  { value: 'device', label: 'Device' },
  { value: 'country', label: 'Country' },
  { value: 'searchAppearance', label: 'Search appearance' },
]

const gscInspection = computed(() => gscData.value?.inspection ?? null)

const breadcrumbItems = computed(() => [
  { label: 'Dashboard', to: '/' },
  { label: 'Analytics', to: '/analytics' },
  { label: appName.value, to: `/analytics/${appName.value}` },
  { label: 'Search' },
])
</script>

<template>
  <div class="space-y-6">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="font-display text-2xl font-semibold text-default">Search — {{ appName }}</h1>
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex gap-1 rounded-lg border border-default p-1 shadow-xs">
          <UButton
            v-for="opt in presetOptions"
            :key="opt.value"
            size="xs"
            :color="preset === opt.value ? 'primary' : 'neutral'"
            :variant="preset === opt.value ? 'solid' : 'outline'"
            class="cursor-pointer"
            @click="onPresetChange(opt.value)"
          >
            {{ opt.label }}
          </UButton>
        </div>
        <UButton
          size="xs"
          variant="ghost"
          :icon="seriesLoading || gscLoading ? 'i-lucide-loader-2' : 'i-lucide-refresh-cw'"
          :class="seriesLoading || gscLoading ? 'animate-spin' : ''"
          class="cursor-pointer text-muted hover:text-default"
          @click="onForceRefresh"
        >
          Refresh
        </UButton>
        <NuxtLink :to="`/analytics/${appName}`">
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-lucide-arrow-left"
            class="cursor-pointer"
          >
            App overview
          </UButton>
        </NuxtLink>
      </div>
    </div>

    <!-- Date-based time series -->
    <div class="grid gap-4 md:grid-cols-2">
      <UCard>
        <template #header>
          <h2 class="text-sm font-medium text-default">Clicks over time</h2>
        </template>
        <AnalyticsLineChart
          v-if="clicksTimeSeries.length"
          :data="clicksTimeSeries"
          :title="`${presetLabel} — ${seriesData?.startDate ?? ''} to ${seriesData?.endDate ?? ''}`"
        />
        <div v-else class="flex h-32 items-center justify-center text-sm text-muted">
          {{ seriesLoading ? 'Loading…' : 'No data' }}
        </div>
      </UCard>
      <UCard>
        <template #header>
          <h2 class="text-sm font-medium text-default">Impressions over time</h2>
        </template>
        <AnalyticsLineChart
          v-if="impressionsTimeSeries.length"
          :data="impressionsTimeSeries"
          :title="`${presetLabel}`"
        />
        <div v-else class="flex h-32 items-center justify-center text-sm text-muted">
          {{ seriesLoading ? 'Loading…' : 'No data' }}
        </div>
      </UCard>
    </div>

    <!-- Dimension table -->
    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-for="dim in dimensions"
              :key="dim.value"
              size="xs"
              :color="dimension === dim.value ? 'primary' : 'neutral'"
              :variant="dimension === dim.value ? 'solid' : 'outline'"
              class="cursor-pointer"
              @click="dimension = dim.value"
            >
              {{ dim.label }}
            </UButton>
          </div>
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
      </template>
      <div v-if="gscData?.rows?.length" class="overflow-x-auto rounded-lg border border-default">
        <UTable :data="tableRows" :columns="gscColumns as any" class="text-sm" />
      </div>
      <div v-else-if="gscLoading" class="flex h-24 items-center justify-center text-sm text-muted">
        Loading…
      </div>
      <div
        v-else
        class="rounded-lg border border-dashed border-default p-6 text-center text-sm text-muted"
      >
        No data for this period or dimension.
      </div>
    </UCard>

    <!-- URL Inspection -->
    <AnalyticsGscInspection v-if="gscInspection?.indexStatusResult" :inspection="gscInspection" />
  </div>
</template>
