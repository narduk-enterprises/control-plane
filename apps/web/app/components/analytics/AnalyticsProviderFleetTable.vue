<script setup lang="ts">
import type {
  AnalyticsProviderFleetMetricColumn,
  AnalyticsProviderFleetTableRow,
} from '~/types/analyticsFleetTable'
import { providerStatusColor, providerStatusText } from '~/utils/analyticsPresentation'

const props = defineProps<{
  rows: AnalyticsProviderFleetTableRow[]
  metricColumns: AnalyticsProviderFleetMetricColumn[]
  loading?: boolean
  emptyMessage: string
}>()

type SortState = false | 'asc' | 'desc'
type SortableHeaderColumn = {
  getIsSorted: () => SortState
  toggleSorting: (desc?: boolean) => void
}

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const NuxtLink = resolveComponent('NuxtLink')

const sorting = shallowRef([
  { id: props.metricColumns[0]?.key ?? 'appName', desc: props.metricColumns.length > 0 },
])

const tableRows = computed(() =>
  props.rows.map((row) => ({
    ...row,
    ...Object.fromEntries(
      props.metricColumns.map((column) => [column.key, row.metrics[column.key]?.sortValue ?? 0]),
    ),
  })),
)

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

const columns = computed(() => [
  {
    accessorKey: 'appName',
    header: sortableHeader('App'),
    meta: { class: { th: 'min-w-[15rem]', td: 'min-w-[15rem]' } },
    cell: ({ row }: { row: { original: AnalyticsProviderFleetTableRow } }) =>
      h('div', { class: 'min-w-0' }, [
        h(
          NuxtLink,
          {
            to: row.original.href,
            class: 'font-medium text-primary transition-colors hover:underline',
          },
          () => row.original.appName,
        ),
        h(
          'p',
          {
            class: 'mt-1 truncate text-xs text-muted',
            title: row.original.hint,
          },
          row.original.hint,
        ),
      ]),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    enableSorting: false,
    meta: { class: { th: 'w-[8rem]', td: 'w-[8rem]' } },
    cell: ({ row }: { row: { original: AnalyticsProviderFleetTableRow } }) =>
      h(
        UBadge,
        {
          color: providerStatusColor(row.original.status),
          variant: 'soft',
          size: 'sm',
        },
        () => providerStatusText(row.original.status),
      ),
  },
  ...props.metricColumns.map((column) => ({
    accessorKey: column.key,
    header: sortableHeader(column.label),
    meta: {
      class: {
        th: 'w-[8rem] text-right',
        td: 'w-[8rem] text-right tabular-nums',
      },
    },
    cell: ({ row }: { row: { original: AnalyticsProviderFleetTableRow } }) =>
      h(
        'span',
        { class: 'font-medium text-default' },
        row.original.metrics[column.key]?.display ?? '0',
      ),
  })),
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
    cell: ({ row }: { row: { original: AnalyticsProviderFleetTableRow } }) =>
      h(
        'p',
        {
          class: 'truncate',
          title: row.original.message,
        },
        row.original.message,
      ),
  },
])

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- UTable expects @nuxt/ui column typing
const columnsForTable = computed(() => columns.value as any)
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-default bg-elevated/20">
    <div class="overflow-x-auto">
      <UTable
        v-model:sorting="sorting"
        :data="tableRows"
        :columns="columnsForTable"
        :loading="loading"
        :empty="emptyMessage"
        class="min-w-[760px] text-sm"
      />
    </div>
  </div>
</template>
