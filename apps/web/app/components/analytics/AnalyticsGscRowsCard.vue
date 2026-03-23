<script setup lang="ts">
import type { GscRow } from '~/types/analytics'

const props = defineProps<{
  title: string
  icon: string
  label: string
  rows: GscRow[]
}>()

const columns = computed(() => [
  {
    accessorKey: 'keys',
    header: props.label,
    meta: { class: { td: 'max-w-[220px] truncate' } },
    cell: ({ row }: { row: { original: GscRow } }) => row.original.keys?.[0] ?? '—',
  },
  {
    accessorKey: 'clicks',
    header: 'Clicks',
    cell: ({ row }: { row: { original: GscRow } }) => (row.original.clicks ?? 0).toLocaleString(),
  },
  {
    accessorKey: 'impressions',
    header: 'Impr.',
    meta: { class: { th: 'hidden lg:table-cell', td: 'hidden lg:table-cell' } },
    cell: ({ row }: { row: { original: GscRow } }) =>
      (row.original.impressions ?? 0).toLocaleString(),
  },
  {
    accessorKey: 'ctr',
    header: 'CTR',
    meta: { class: { th: 'hidden xl:table-cell', td: 'hidden xl:table-cell' } },
    cell: ({ row }: { row: { original: GscRow } }) =>
      `${(((row.original.ctr ?? 0) as number) * 100).toFixed(1)}%`,
  },
])
</script>

<template>
  <UCard v-if="rows.length" class="overflow-hidden">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon :name="icon" class="text-primary" />
        <h3 class="text-sm font-medium text-default">{{ title }}</h3>
      </div>
    </template>

    <div class="max-h-72 overflow-auto -mx-4 sm:mx-0">
      <UTable :data="rows" :columns="columns" class="text-xs" />
    </div>
  </UCard>
</template>
