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

// ── Computed data with provider awareness ──
const hasGA = computed(() => !!props.data?.ga?.summary)
const hasGSC = computed(() => !!props.data?.gsc?.totals)
const hasPH = computed(() => !!props.data?.posthog?.summary)
const hasAnyData = computed(() => hasGA.value || hasGSC.value || hasPH.value)

const gaUsers = computed(() => props.data?.ga?.summary?.activeUsers ?? 0)
const gaPageviews = computed(() => props.data?.ga?.summary?.screenPageViews ?? 0)
const gscClicks = computed(() => props.data?.gsc?.totals?.clicks ?? 0)
const phEvents = computed(() => Number(props.data?.posthog?.summary?.event_count ?? 0))
const phUniqueUsers = computed(() => Number(props.data?.posthog?.summary?.unique_users ?? 0))

const timeSeries = computed(
  () => props.data?.ga?.timeSeries ?? props.data?.posthog?.timeSeries ?? [],
)

const userDelta = computed(() => props.data?.ga?.deltas?.users ?? undefined)

// Border color based on trend
const borderClass = computed(() => {
  if (!hasAnyData.value) return 'border-default'
  const d = userDelta.value
  if (d == null) return 'border-default'
  if (d >= 20) return 'border-l-4 border-l-success'
  if (d <= -20) return 'border-l-4 border-l-error'
  return 'border-default'
})

// Provider dots
const providers = computed(() => [
  { key: 'GA4', active: hasGA.value, color: 'bg-blue-500' },
  { key: 'GSC', active: hasGSC.value, color: 'bg-green-500' },
  { key: 'PH', active: hasPH.value, color: 'bg-orange-500' },
])
</script>

<template>
  <NuxtLink
    :to="`/analytics/${appName}`"
    class="block rounded-xl border border-default bg-elevated/50 p-3 sm:p-4 transition-all hover:scale-[1.02] hover:shadow-elevated"
    :class="borderClass"
  >
    <!-- Header -->
    <div class="flex items-start justify-between gap-2 mb-2">
      <span class="font-medium text-default truncate text-sm">{{ appName }}</span>
      <div class="flex items-center gap-1.5 shrink-0">
        <!-- Provider dots -->
        <div class="flex gap-0.5">
          <div
            v-for="p in providers"
            :key="p.key"
            :title="`${p.key}: ${p.active ? 'Data available' : 'No data'}`"
            class="size-1.5 rounded-full"
            :class="p.active ? p.color : 'bg-default/20'"
          />
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
    </div>

    <!-- Loading -->
    <div v-if="loading && !data" class="flex items-center gap-2 text-sm text-muted">
      <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
      Loading…
    </div>

    <template v-else-if="hasAnyData">
      <!-- Sparkline -->
      <div v-if="timeSeries.length" class="mb-2 flex justify-end">
        <AnalyticsSparkline :data="timeSeries" :width="120" :height="32" />
      </div>

      <!-- Stats Grid — only show providers with data -->
      <div
        class="grid gap-2 text-center text-xs"
        :class="hasPH && hasGA ? 'grid-cols-4' : hasPH || hasGA ? 'grid-cols-3' : 'grid-cols-2'"
      >
        <!-- PostHog events (most likely to have data) -->
        <div v-if="hasPH">
          <p class="text-muted">Events</p>
          <p class="font-semibold text-default">{{ phEvents.toLocaleString() }}</p>
        </div>
        <div v-if="hasPH && phUniqueUsers > 0">
          <p class="text-muted">Users</p>
          <p class="font-semibold text-default">{{ phUniqueUsers.toLocaleString() }}</p>
        </div>

        <!-- GA4 -->
        <div v-if="hasGA">
          <p class="text-muted">GA Users</p>
          <p class="font-semibold text-default">{{ gaUsers.toLocaleString() }}</p>
          <p
            v-if="userDelta !== undefined"
            class="text-[10px]"
            :class="userDelta >= 0 ? 'text-success' : 'text-error'"
          >
            {{ userDelta >= 0 ? '+' : '' }}{{ userDelta.toFixed(0) }}%
          </p>
        </div>
        <div v-if="hasGA">
          <p class="text-muted">PV</p>
          <p class="font-semibold text-default">{{ gaPageviews.toLocaleString() }}</p>
        </div>

        <!-- GSC -->
        <div v-if="hasGSC">
          <p class="text-muted">Clicks</p>
          <p class="font-semibold text-default">{{ gscClicks.toLocaleString() }}</p>
        </div>
      </div>
    </template>

    <!-- No data state -->
    <div v-else-if="!loading" class="text-center text-xs text-muted py-2">
      <UIcon name="i-lucide-database" class="size-4 mx-auto mb-1" />
      No cached data
    </div>
  </NuxtLink>
</template>
