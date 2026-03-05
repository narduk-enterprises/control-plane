<script setup lang="ts">
import type { FleetAppAnalyticsSummary } from '~/composables/useFleetAnalyticsSummary'
import type { FleetApp } from '~/composables/useFleet'
import type { FleetAppStatusRecord } from '~/types/fleet'

const props = defineProps<{
  apps: FleetApp[]
  summaryMap: Record<string, FleetAppAnalyticsSummary | null>
  statusMap: Map<string, FleetAppStatusRecord>
  loading?: boolean
  sortKey?: string
  sortDir?: 'asc' | 'desc'
}>()

const emit = defineEmits<{
  (e: 'update:sortKey', v: string): void
  (e: 'update:sortDir', v: 'asc' | 'desc'): void
}>()

const sortedApps = computed(() => {
  const key = props.sortKey ?? 'name'
  const dir = props.sortDir ?? 'asc'
  const list = [...props.apps]
  list.sort((a, b) => {
    const dataA = props.summaryMap[a.name]
    const dataB = props.summaryMap[b.name]
    let va: number | string
    let vb: number | string
    switch (key) {
      case 'users':
        va = dataA?.ga?.summary?.activeUsers ?? 0
        vb = dataB?.ga?.summary?.activeUsers ?? 0
        break
      case 'pageviews':
        va = dataA?.ga?.summary?.screenPageViews ?? 0
        vb = dataB?.ga?.summary?.screenPageViews ?? 0
        break
      case 'clicks':
        va = dataA?.gsc?.totals?.clicks ?? 0
        vb = dataB?.gsc?.totals?.clicks ?? 0
        break
      case 'events':
        va = Number(dataA?.posthog?.summary?.event_count ?? 0)
        vb = Number(dataB?.posthog?.summary?.event_count ?? 0)
        break
      default:
        va = a.name
        vb = b.name
    }
    const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
    return dir === 'asc' ? cmp : -cmp
  })
  return list
})

function toggleSort(k: string) {
  if (props.sortKey === k) {
    emit('update:sortDir', props.sortDir === 'asc' ? 'desc' : 'asc')
  } else {
    emit('update:sortKey', k)
    emit('update:sortDir', k === 'name' ? 'asc' : 'desc')
  }
}

const columns = computed(() => [
  { key: 'name', label: 'App', class: 'font-medium' },
  { key: 'sparkline', label: '', class: 'w-20' },
  { key: 'users', label: 'Users' },
  { key: 'pageviews', label: 'Pageviews' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'events', label: 'Events' },
  { key: 'status', label: 'Status' },
])
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-default">
    <table class="w-full min-w-[600px] text-sm">
      <thead>
        <tr class="border-b border-default bg-elevated/50">
          <th
            v-for="col in columns"
            :key="col.key"
            class="px-3 py-2 text-left font-medium text-muted"
            :class="col.class"
          >
            <button
              v-if="col.key !== 'sparkline' && col.key !== 'status'"
              type="button"
              class="hover:text-default"
              @click="toggleSort(col.key)"
            >
              {{ col.label }}
            </button>
            <span v-else>{{ col.label }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="app in sortedApps"
          :key="app.name"
          class="border-b border-default/50 hover:bg-elevated/30"
        >
          <td class="px-3 py-2">
            <NuxtLink :to="`/fleet/${app.name}`" class="font-medium text-primary hover:underline">
              {{ app.name }}
            </NuxtLink>
          </td>
          <td class="px-3 py-2">
            <AnalyticsSparkline
              :data="summaryMap[app.name]?.ga?.timeSeries ?? summaryMap[app.name]?.posthog?.timeSeries ?? []"
              :width="80"
              :height="24"
            />
          </td>
          <td class="px-3 py-2 text-right tabular-nums">
            {{ (summaryMap[app.name]?.ga?.summary?.activeUsers ?? 0).toLocaleString() }}
          </td>
          <td class="px-3 py-2 text-right tabular-nums">
            {{ (summaryMap[app.name]?.ga?.summary?.screenPageViews ?? 0).toLocaleString() }}
          </td>
          <td class="px-3 py-2 text-right tabular-nums">
            {{ (summaryMap[app.name]?.gsc?.totals?.clicks ?? 0).toLocaleString() }}
          </td>
          <td class="px-3 py-2 text-right tabular-nums">
            {{ Number(summaryMap[app.name]?.posthog?.summary?.event_count ?? 0).toLocaleString() }}
          </td>
          <td class="px-3 py-2">
            <UBadge
              v-if="statusMap.get(app.name)"
              :color="statusMap.get(app.name)!.status === 'up' ? 'success' : 'error'"
              variant="subtle"
              size="xs"
            >
              {{ statusMap.get(app.name)!.status }}
            </UBadge>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
