<script setup lang="ts">
import type { FleetAppAnalyticsSummary } from '~/composables/useFleetAnalyticsSummary'

const props = defineProps<{
  apps: Record<string, FleetAppAnalyticsSummary>
  loading?: boolean
}>()

const totals = computed(() => {
  let users = 0
  let pageviews = 0
  let clicks = 0
  let events = 0
  for (const data of Object.values(props.apps)) {
    users += data.ga?.summary?.activeUsers ?? 0
    pageviews += data.ga?.summary?.screenPageViews ?? 0
    clicks += data.gsc?.totals?.clicks ?? 0
    events += Number(data.posthog?.summary?.event_count ?? 0)
  }
  return { users, pageviews, clicks, events }
})

const deltas = computed(() => {
  let userDelta = 0
  let pvDelta = 0
  let count = 0
  for (const data of Object.values(props.apps)) {
    const d = data.ga?.deltas
    if (d?.users !== undefined) {
      userDelta += d.users
      count++
    }
    if (d?.pageviews !== undefined) pvDelta += d.pageviews
  }
  const n = count || 1
  return { users: userDelta / n, pageviews: pvDelta / n }
})
</script>

<template>
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
    <UCard class="bg-elevated/50">
      <div class="flex items-center gap-3">
        <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <UIcon name="i-lucide-users" class="size-5" />
        </div>
        <div>
          <p class="text-xs text-muted">Total Users</p>
          <p class="text-xl font-semibold text-default">
            <template v-if="loading && totals.users === 0">—</template>
            <template v-else>{{ totals.users.toLocaleString() }}</template>
          </p>
          <p v-if="deltas.users !== 0" class="text-xs" :class="deltas.users > 0 ? 'text-success' : 'text-error'">
            {{ deltas.users > 0 ? '+' : '' }}{{ deltas.users.toFixed(1) }}% vs prev
          </p>
        </div>
      </div>
    </UCard>
    <UCard class="bg-elevated/50">
      <div class="flex items-center gap-3">
        <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <UIcon name="i-lucide-file-text" class="size-5" />
        </div>
        <div>
          <p class="text-xs text-muted">Pageviews</p>
          <p class="text-xl font-semibold text-default">
            <template v-if="loading && totals.pageviews === 0">—</template>
            <template v-else>{{ totals.pageviews.toLocaleString() }}</template>
          </p>
          <p v-if="deltas.pageviews !== 0" class="text-xs" :class="deltas.pageviews > 0 ? 'text-success' : 'text-error'">
            {{ deltas.pageviews > 0 ? '+' : '' }}{{ deltas.pageviews.toFixed(1) }}% vs prev
          </p>
        </div>
      </div>
    </UCard>
    <UCard class="bg-elevated/50">
      <div class="flex items-center gap-3">
        <div class="flex size-10 items-center justify-center rounded-lg bg-info/10 text-info">
          <UIcon name="i-lucide-mouse-pointer-click" class="size-5" />
        </div>
        <div>
          <p class="text-xs text-muted">GSC Clicks</p>
          <p class="text-xl font-semibold text-default">
            <template v-if="loading && totals.clicks === 0">—</template>
            <template v-else>{{ totals.clicks.toLocaleString() }}</template>
          </p>
        </div>
      </div>
    </UCard>
    <UCard class="bg-elevated/50">
      <div class="flex items-center gap-3">
        <div class="flex size-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
          <UIcon name="i-lucide-activity" class="size-5" />
        </div>
        <div>
          <p class="text-xs text-muted">PostHog Events</p>
          <p class="text-xl font-semibold text-default">
            <template v-if="loading && totals.events === 0">—</template>
            <template v-else>{{ totals.events.toLocaleString() }}</template>
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>
