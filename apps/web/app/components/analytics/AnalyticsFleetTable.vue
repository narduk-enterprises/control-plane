<script setup lang="ts">
import type { FleetAnalyticsSnapshot } from '~/types/analytics'
import type { FleetRegistryApp, FleetAppStatusRecord } from '~/types/fleet'

const props = defineProps<{
  apps: FleetRegistryApp[]
  snapshotMap: Record<string, FleetAnalyticsSnapshot | null>
  statusMap: Map<string, FleetAppStatusRecord>
  loading?: boolean
  sortKey?: string
  sortDir?: 'asc' | 'desc'
}>()

const emit = defineEmits<{
  (event: 'update:sortKey', value: string): void
  (event: 'update:sortDir', value: 'asc' | 'desc'): void
}>()

function metricValue(snapshot: FleetAnalyticsSnapshot | null, key: string) {
  switch (key) {
    case 'users':
      return snapshot?.ga.metrics?.summary?.activeUsers ?? 0
    case 'pageviews':
      return snapshot?.ga.metrics?.summary?.screenPageViews ?? 0
    case 'clicks':
      return snapshot?.gsc.metrics?.totals?.clicks ?? 0
    case 'events':
      return Number(snapshot?.posthog.metrics?.summary?.event_count ?? 0)
    default:
      return 0
  }
}

const sortedApps = computed(() => {
  const list = [...props.apps]
  const sortKey = props.sortKey ?? 'name'
  const sortDir = props.sortDir ?? 'asc'

  list.sort((left, right) => {
    if (sortKey === 'name') {
      const compare = left.name.localeCompare(right.name)
      return sortDir === 'asc' ? compare : -compare
    }

    const compare =
      metricValue(props.snapshotMap[left.name] ?? null, sortKey) -
      metricValue(props.snapshotMap[right.name] ?? null, sortKey)
    return sortDir === 'asc' ? compare : -compare
  })

  return list
})

const displayRows = computed(() =>
  sortedApps.value.map((app) => ({
    app,
    snapshot: props.snapshotMap[app.name] ?? null,
    status: props.statusMap.get(app.name),
    users: metricValue(props.snapshotMap[app.name] ?? null, 'users'),
    pageviews: metricValue(props.snapshotMap[app.name] ?? null, 'pageviews'),
    clicks: metricValue(props.snapshotMap[app.name] ?? null, 'clicks'),
    events: metricValue(props.snapshotMap[app.name] ?? null, 'events'),
  })),
)

function toggleSort(key: string) {
  if (props.sortKey === key) {
    emit('update:sortDir', props.sortDir === 'asc' ? 'desc' : 'asc')
    return
  }

  emit('update:sortKey', key)
  emit('update:sortDir', key === 'name' ? 'asc' : 'desc')
}

function providerCount(snapshot: FleetAnalyticsSnapshot | null) {
  if (!snapshot) return '0/4'
  const statuses = [
    snapshot.ga.status,
    snapshot.gsc.status,
    snapshot.posthog.status,
    snapshot.indexnow.status,
  ]
  return `${statuses.filter((status) => status === 'healthy').length}/4`
}
</script>

<template>
  <div class="overflow-x-auto rounded-2xl border border-default bg-elevated/20">
    <!-- eslint-disable-next-line narduk/no-native-table -- dense custom analytics matrix -->
    <table class="w-full min-w-[760px] text-sm">
      <thead>
        <tr class="border-b border-default bg-default/5">
          <th class="px-3 py-2 text-left">
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              class="cursor-pointer"
              @click="toggleSort('name')"
            >
              App
            </UButton>
          </th>
          <th class="px-3 py-2 text-left">Providers</th>
          <th class="px-3 py-2 text-right">
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              class="cursor-pointer"
              @click="toggleSort('users')"
            >
              Users
            </UButton>
          </th>
          <th class="px-3 py-2 text-right">
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              class="cursor-pointer"
              @click="toggleSort('pageviews')"
            >
              Pageviews
            </UButton>
          </th>
          <th class="px-3 py-2 text-right">
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              class="cursor-pointer"
              @click="toggleSort('clicks')"
            >
              GSC Clicks
            </UButton>
          </th>
          <th class="px-3 py-2 text-right">
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              class="cursor-pointer"
              @click="toggleSort('events')"
            >
              Events
            </UButton>
          </th>
          <th class="px-3 py-2 text-left">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in displayRows"
          :key="row.app.name"
          class="border-b border-default/50 transition-colors hover:bg-default/5"
        >
          <td class="px-3 py-3">
            <NuxtLink
              :to="`/analytics/${row.app.name}`"
              class="font-medium text-primary hover:underline"
            >
              {{ row.app.name }}
            </NuxtLink>
          </td>
          <td class="px-3 py-3 text-xs text-muted">
            {{ providerCount(row.snapshot) }}
          </td>
          <td class="px-3 py-3 text-right tabular-nums">
            {{ row.users.toLocaleString() }}
          </td>
          <td class="px-3 py-3 text-right tabular-nums">
            {{ row.pageviews.toLocaleString() }}
          </td>
          <td class="px-3 py-3 text-right tabular-nums">
            {{ row.clicks.toLocaleString() }}
          </td>
          <td class="px-3 py-3 text-right tabular-nums">
            {{ row.events.toLocaleString() }}
          </td>
          <td class="px-3 py-3">
            <UBadge
              v-if="row.status"
              :color="row.status.status === 'up' ? 'success' : 'error'"
              variant="subtle"
              size="xs"
            >
              {{ row.status.status }}
            </UBadge>
            <span v-else class="text-xs text-muted">Unknown</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
