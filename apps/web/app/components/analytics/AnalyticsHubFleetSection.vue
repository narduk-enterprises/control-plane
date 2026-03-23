<script setup lang="ts">
import type { FleetAnalyticsSnapshot } from '~/types/analytics'
import type { FleetRegistryApp, FleetAppStatusRecord } from '~/types/fleet'

defineProps<{
  apps: FleetRegistryApp[]
  snapshotMap: Record<string, FleetAnalyticsSnapshot | null>
  statusMap: Map<string, FleetAppStatusRecord>
  loading?: boolean
  sortKey?: string
  sortDir?: 'asc' | 'desc'
}>()

const statusFilter = defineModel<'all' | 'up' | 'down'>('statusFilter', { required: true })

const emit = defineEmits<{
  (e: 'update:sortKey', value: string): void
  (e: 'update:sortDir', value: 'asc' | 'desc'): void
}>()
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-sm text-muted">Status</span>
      <UButton
        v-for="filterValue in ['all', 'up', 'down'] as const"
        :key="filterValue"
        size="xs"
        :color="statusFilter === filterValue ? 'primary' : 'neutral'"
        variant="outline"
        class="cursor-pointer"
        @click="statusFilter = filterValue"
      >
        {{ filterValue === 'all' ? 'All' : filterValue === 'up' ? 'Up' : 'Down' }}
      </UButton>
    </div>

    <AnalyticsFleetTable
      :apps="apps"
      :snapshot-map="snapshotMap"
      :status-map="statusMap"
      :loading="loading"
      :sort-key="sortKey"
      :sort-dir="sortDir"
      @update:sort-key="emit('update:sortKey', $event)"
      @update:sort-dir="emit('update:sortDir', $event)"
    />
  </div>
</template>
