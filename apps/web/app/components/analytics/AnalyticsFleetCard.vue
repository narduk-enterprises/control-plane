<script setup lang="ts">
import type { FleetAnalyticsSnapshot } from '~/types/analytics'
import type { FleetAppStatusRecord } from '~/types/fleet'

const props = defineProps<{
  appName: string
  appUrl: string
  snapshot: FleetAnalyticsSnapshot | null
  status: FleetAppStatusRecord | undefined
  loading?: boolean
}>()

const gaUsers = computed(() => props.snapshot?.ga.metrics?.summary?.activeUsers ?? 0)
const gaPageviews = computed(() => props.snapshot?.ga.metrics?.summary?.screenPageViews ?? 0)
const gscClicks = computed(() => props.snapshot?.gsc.metrics?.totals?.clicks ?? 0)
const posthogEvents = computed(() =>
  Number(props.snapshot?.posthog.metrics?.summary?.event_count ?? 0),
)
const posthogUsers = computed(() =>
  Number(props.snapshot?.posthog.metrics?.summary?.unique_users ?? 0),
)
const userDelta = computed(() => props.snapshot?.ga.metrics?.deltas?.users)

const providerBadges = computed(() => [
  { key: 'ga', label: 'GA4', status: props.snapshot?.ga.status ?? 'no_data' },
  { key: 'gsc', label: 'GSC', status: props.snapshot?.gsc.status ?? 'no_data' },
  { key: 'posthog', label: 'PH', status: props.snapshot?.posthog.status ?? 'no_data' },
])

const timeSeries = computed(
  () => props.snapshot?.ga.metrics?.timeSeries ?? props.snapshot?.posthog.metrics?.timeSeries ?? [],
)

function badgeColor(status: string) {
  switch (status) {
    case 'healthy':
      return 'success'
    case 'stale':
      return 'warning'
    case 'missing_registry':
    case 'missing_config':
    case 'access_denied':
    case 'error':
      return 'error'
    default:
      return 'neutral'
  }
}

const hasAnyMetrics = computed(() => {
  return (
    !!props.snapshot &&
    (gaUsers.value > 0 ||
      gaPageviews.value > 0 ||
      gscClicks.value > 0 ||
      posthogEvents.value > 0 ||
      timeSeries.value.length > 0)
  )
})
</script>

<template>
  <NuxtLink
    :to="`/analytics/${appName}`"
    class="block rounded-2xl border border-default bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.02))] p-4 transition-all hover:-translate-y-1 hover:shadow-elevated"
  >
    <div class="mb-3 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate font-semibold text-default">{{ appName }}</p>
        <p class="truncate text-xs text-muted">{{ appUrl.replace(/^https?:\/\//, '') }}</p>
      </div>
      <UBadge
        v-if="status"
        :color="status.status === 'up' ? 'success' : 'error'"
        variant="subtle"
        size="xs"
      >
        {{ status.status }}
      </UBadge>
    </div>

    <div class="mb-3 flex flex-wrap gap-1.5">
      <UBadge
        v-for="provider in providerBadges"
        :key="provider.key"
        :color="badgeColor(provider.status)"
        variant="soft"
        size="xs"
      >
        {{ provider.label }}
      </UBadge>
    </div>

    <div v-if="loading && !snapshot" class="flex items-center gap-2 text-sm text-muted">
      <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
      Loading snapshot…
    </div>

    <template v-else-if="hasAnyMetrics">
      <div v-if="timeSeries.length" class="mb-3 flex justify-end">
        <AnalyticsSparkline :data="timeSeries" :width="128" :height="28" />
      </div>

      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="rounded-xl bg-default/5 px-3 py-2">
          <p class="text-muted">Users</p>
          <p class="font-semibold text-default">{{ gaUsers.toLocaleString() }}</p>
          <p
            v-if="userDelta !== undefined"
            class="text-[10px]"
            :class="userDelta >= 0 ? 'text-success' : 'text-error'"
          >
            {{ userDelta >= 0 ? '+' : '' }}{{ userDelta.toFixed(0) }}%
          </p>
        </div>
        <div class="rounded-xl bg-default/5 px-3 py-2">
          <p class="text-muted">Pageviews</p>
          <p class="font-semibold text-default">{{ gaPageviews.toLocaleString() }}</p>
        </div>
        <div class="rounded-xl bg-default/5 px-3 py-2">
          <p class="text-muted">GSC Clicks</p>
          <p class="font-semibold text-default">{{ gscClicks.toLocaleString() }}</p>
        </div>
        <div class="rounded-xl bg-default/5 px-3 py-2">
          <p class="text-muted">Events</p>
          <p class="font-semibold text-default">{{ posthogEvents.toLocaleString() }}</p>
          <p v-if="posthogUsers > 0" class="text-[10px] text-muted">
            {{ posthogUsers.toLocaleString() }} users
          </p>
        </div>
      </div>
    </template>

    <div v-else class="rounded-xl border border-dashed border-default/80 px-4 py-5 text-center">
      <UIcon name="i-lucide-database" class="mx-auto mb-2 size-5 text-muted" />
      <p class="text-sm font-medium text-default">No data for this range</p>
      <p class="mt-1 text-xs text-muted">
        Open the app snapshot to inspect provider state and remediation steps.
      </p>
    </div>
  </NuxtLink>
</template>
