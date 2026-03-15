<script setup lang="ts">
import type { GscRow } from '~/types/analytics'

defineProps<{
  queries: GscRow[]
  devices: GscRow[]
}>()
</script>

<template>
  <div class="grid gap-4 md:grid-cols-2">
    <UCard v-if="queries.length" class="overflow-hidden">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-search" class="text-primary" />
          <h3 class="text-sm font-medium">Top Queries (GSC)</h3>
        </div>
      </template>
      <div class="max-h-64 overflow-auto -mx-4 sm:mx-0">
        <UTable
          :data="queries"
          :columns="[
            {
              accessorKey: 'keys',
              header: 'Query',
              meta: { class: { td: 'max-w-[180px] truncate' } },
              cell: ({ row }: any) => row.original.keys?.[0] ?? '—',
            },
            {
              accessorKey: 'clicks',
              header: 'Clicks',
              cell: ({ row }: any) => (row.original.clicks ?? 0).toLocaleString(),
            },
            {
              accessorKey: 'impressions',
              header: 'Impr.',
              meta: { class: { th: 'hidden sm:table-cell', td: 'hidden sm:table-cell' } },
              cell: ({ row }: any) => (row.original.impressions ?? 0).toLocaleString(),
            },
          ]"
          class="text-xs"
        />
      </div>
    </UCard>
    <UCard v-if="devices.length" class="overflow-hidden">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-smartphone" class="text-primary" />
          <h3 class="text-sm font-medium">Device (GSC)</h3>
        </div>
      </template>
      <div class="max-h-48 overflow-auto -mx-4 sm:mx-0">
        <UTable
          :data="devices"
          :columns="[
            {
              accessorKey: 'keys',
              header: 'Device',
              cell: ({ row }: any) => row.original.keys?.[0] ?? '—',
            },
            {
              accessorKey: 'clicks',
              header: 'Clicks',
              cell: ({ row }: any) => (row.original.clicks ?? 0).toLocaleString(),
            },
          ]"
          class="text-xs"
        />
      </div>
    </UCard>
  </div>
</template>
