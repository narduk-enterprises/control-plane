<script setup lang="ts">
import type { FleetD1StatementResult as Batch } from '~/types/fleet'

const props = defineProps<{
  index: number
  batch: Batch
}>()

const rows = computed(() => props.batch.results ?? [])

const columnKeys = computed(() => {
  const keys = new Set<string>()
  for (const row of rows.value) {
    for (const k of Object.keys(row)) {
      keys.add(k)
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b))
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- UTable column typing from dynamic keys
const columns = computed<any[]>(() =>
  columnKeys.value.map((key) => ({
    accessorKey: key,
    header: key,
    meta: { class: { td: 'max-w-[280px] whitespace-normal break-words font-mono text-xs' } },
    cell: ({ row }: { row: { original: Record<string, unknown> } }) => {
      const v = row.original[key]
      if (v === null || v === undefined) return '—'
      if (typeof v === 'object') return JSON.stringify(v)
      return String(v)
    },
  })),
)

function formatMeta(meta: Record<string, unknown>): string {
  try {
    return JSON.stringify(meta, null, 2)
  } catch {
    return String(meta)
  }
}
</script>

<template>
  <UCard class="overflow-hidden">
    <template #header>
      <div class="flex flex-wrap items-center gap-2">
        <UBadge color="neutral" variant="subtle">Statement {{ index + 1 }}</UBadge>
        <UBadge v-if="batch.success === false" color="error" variant="soft">Failed</UBadge>
        <UBadge v-else-if="batch.success === true" color="success" variant="soft">OK</UBadge>
      </div>
    </template>

    <div v-if="batch.meta && Object.keys(batch.meta).length" class="mb-4">
      <p class="mb-1 text-xs font-medium text-muted">Execution meta</p>
      <pre
        class="card-base max-h-40 overflow-auto rounded-lg border border-default/10 p-3 text-xs text-default"
        >{{ formatMeta(batch.meta as Record<string, unknown>) }}</pre
      >
    </div>

    <div v-if="rows.length === 0" class="text-sm text-muted">No result rows (DDL/DML or empty set).</div>
    <div v-else class="-mx-4 max-h-[min(24rem,50vh)] overflow-auto sm:mx-0">
      <!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic columns -->
      <UTable :data="rows" :columns="columns as any" class="text-xs" />
    </div>
  </UCard>
</template>
