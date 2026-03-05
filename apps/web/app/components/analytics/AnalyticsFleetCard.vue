<script setup lang="ts">
import type { FleetAppAnalyticsSummary } from '~/composables/useFleetAnalyticsSummary'
import type { FleetAppStatusRecord } from '~/types/fleet'

const props = defineProps<{
  appName: string
  appUrl: string
  data: FleetAppAnalyticsSummary | null
  status: FleetAppStatusRecord | undefined
  loading?: boolean
}>()

const users = computed(() => props.data?.ga?.summary?.activeUsers ?? 0)
const pageviews = computed(() => props.data?.ga?.summary?.screenPageViews ?? 0)
const clicks = computed(() => props.data?.gsc?.totals?.clicks ?? 0)
const events = computed(() => Number(props.data?.posthog?.summary?.event_count ?? 0))

const timeSeries = computed(() => props.data?.ga?.timeSeries ?? props.data?.posthog?.timeSeries ?? [])

const userDelta = computed(() => props.data?.ga?.deltas?.users ?? undefined)
const pvDelta = computed(() => props.data?.ga?.deltas?.pageviews ?? undefined)

const borderClass = computed(() => {
  const d = userDelta.value ?? pvDelta.value
  if (d == null) return 'border-default'
  if (d >= 20) return 'border-l-4 border-l-success'
  if (d <= -20) return 'border-l-4 border-l-error'
  return 'border-default'
})
</script>

<template>
  <NuxtLink
    :to="`/analytics/${appName}`"
    class="block rounded-xl border border-default bg-elevated/50 p-4 transition-all hover:scale-[1.02] hover:shadow-elevated"
    :class="borderClass"
  >
    <div class="flex items-start justify-between gap-2 mb-2">
      <span class="font-medium text-default truncate">{{ appName }}</span>
      <UBadge
        v-if="status"
        :color="status.status === 'up' ? 'success' : 'error'"
        variant="subtle"
        size="xs"
      >
        {{ status.status }}
      </UBadge>
    </div>
    <div v-if="loading && !data" class="flex items-center gap-2 text-sm text-muted">
      <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
      Loading…
    </div>
    <template v-else>
      <div class="mb-2 flex justify-end">
        <AnalyticsSparkline :data="timeSeries" :width="120" :height="32" />
      </div>
      <div class="grid grid-cols-4 gap-2 text-center text-xs">
        <div>
          <p class="text-muted">Users</p>
          <p class="font-semibold text-default">{{ users.toLocaleString() }}</p>
          <p v-if="userDelta !== undefined" :class="userDelta >= 0 ? 'text-success' : 'text-error'">
            {{ userDelta >= 0 ? '+' : '' }}{{ userDelta.toFixed(0) }}%
          </p>
        </div>
        <div>
          <p class="text-muted">PV</p>
          <p class="font-semibold text-default">{{ pageviews.toLocaleString() }}</p>
          <p v-if="pvDelta !== undefined" :class="pvDelta >= 0 ? 'text-success' : 'text-error'">
            {{ pvDelta >= 0 ? '+' : '' }}{{ pvDelta.toFixed(0) }}%
          </p>
        </div>
        <div>
          <p class="text-muted">Clicks</p>
          <p class="font-semibold text-default">{{ clicks.toLocaleString() }}</p>
        </div>
        <div>
          <p class="text-muted">Events</p>
          <p class="font-semibold text-default">{{ events.toLocaleString() }}</p>
        </div>
      </div>
    </template>
  </NuxtLink>
</template>
