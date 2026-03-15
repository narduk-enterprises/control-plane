<script setup lang="ts">
import type { FleetAppAnalyticsSummary } from '~/composables/useFleetAnalyticsSummary'
import type { StatCardConfig } from '~/types/analytics'

const props = defineProps<{
  apps: Record<string, FleetAppAnalyticsSummary>
  loading?: boolean
}>()

// ── Aggregate across all apps ──
const totals = computed(() => {
  let gaUsers = 0
  let gaPageviews = 0
  let gscClicks = 0
  let gscImpressions = 0
  let phEvents = 0
  let phUniqueUsers = 0
  let gaApps = 0
  let gscApps = 0
  let phApps = 0

  for (const data of Object.values(props.apps)) {
    if (data.ga?.summary) {
      gaUsers += data.ga.summary.activeUsers ?? 0
      gaPageviews += data.ga.summary.screenPageViews ?? 0
      gaApps++
    }
    if (data.gsc?.totals) {
      gscClicks += data.gsc.totals.clicks ?? 0
      gscImpressions += data.gsc.totals.impressions ?? 0
      gscApps++
    }
    if (data.posthog?.summary) {
      phEvents += Number(data.posthog.summary.event_count ?? 0)
      phUniqueUsers += Number(data.posthog.summary.unique_users ?? 0)
      phApps++
    }
  }
  return {
    gaUsers,
    gaPageviews,
    gscClicks,
    gscImpressions,
    phEvents,
    phUniqueUsers,
    gaApps,
    gscApps,
    phApps,
  }
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

const totalApps = computed(() => Object.keys(props.apps).length)

// ── Build stat cards dynamically based on which providers have data ──
const statCards = computed<StatCardConfig[]>(() => {
  const t = totals.value
  const d = deltas.value
  const cards: StatCardConfig[] = []

  // Always show PostHog events if we have any
  if (t.phApps > 0) {
    cards.push({
      label: 'Total Events',
      value: t.phEvents || undefined,
      icon: 'i-lucide-activity',
      iconColor: 'bg-orange-500/10 text-orange-500',
    })
    if (t.phUniqueUsers > 0) {
      cards.push({
        label: 'Unique Users (PH)',
        value: t.phUniqueUsers,
        icon: 'i-lucide-users',
        iconColor: 'bg-orange-500/10 text-orange-500',
      })
    }
  }

  // GA4 users/pageviews only if GA actually returned data
  if (t.gaApps > 0) {
    cards.push({
      label: 'GA4 Users',
      value: t.gaUsers || undefined,
      delta: d.users || undefined,
      icon: 'i-lucide-bar-chart-2',
      iconColor: 'bg-blue-500/10 text-blue-500',
    })
    cards.push({
      label: 'GA4 Pageviews',
      value: t.gaPageviews || undefined,
      delta: d.pageviews || undefined,
      icon: 'i-lucide-file-text',
      iconColor: 'bg-blue-500/10 text-blue-500',
    })
  }

  // GSC clicks/impressions only if GSC returned data
  if (t.gscApps > 0) {
    cards.push({
      label: 'GSC Clicks',
      value: t.gscClicks || undefined,
      icon: 'i-lucide-mouse-pointer-click',
      iconColor: 'bg-green-500/10 text-green-500',
    })
    cards.push({
      label: 'GSC Impressions',
      value: t.gscImpressions || undefined,
      icon: 'i-lucide-eye',
      iconColor: 'bg-green-500/10 text-green-500',
    })
  }

  return cards
})

// ── Provider status ──
interface ProviderStatus {
  name: string
  icon: string
  color: string
  count: number
  total: number
}

const providerStatuses = computed<ProviderStatus[]>(() => {
  const t = totals.value
  const total = totalApps.value
  return [
    { name: 'GA4', icon: 'i-lucide-bar-chart-2', color: 'text-blue-500', count: t.gaApps, total },
    { name: 'GSC', icon: 'i-lucide-search', color: 'text-green-500', count: t.gscApps, total },
    {
      name: 'PostHog',
      icon: 'i-lucide-activity',
      color: 'text-orange-500',
      count: t.phApps,
      total,
    },
  ]
})
</script>

<template>
  <div class="mb-6 space-y-3">
    <!-- Provider Status Badges -->
    <div class="flex flex-wrap items-center gap-2">
      <div
        v-for="p in providerStatuses"
        :key="p.name"
        class="flex items-center gap-1.5 rounded-full border border-default bg-elevated/50 px-3 py-1 text-xs"
      >
        <UIcon :name="p.icon" :class="['size-3.5', p.color]" />
        <span class="font-medium text-default">{{ p.name }}</span>
        <span :class="p.count > 0 ? 'text-success' : 'text-muted'">
          {{ p.count }}/{{ p.total }}
        </span>
        <UIcon
          :name="p.count > 0 ? 'i-lucide-check-circle' : 'i-lucide-alert-circle'"
          :class="['size-3', p.count > 0 ? 'text-success' : 'text-muted']"
        />
      </div>
    </div>

    <!-- KPI Cards -->
    <div v-if="statCards.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <AnalyticsStatCard
        v-for="card in statCards"
        :key="card.label"
        v-bind="card"
        :loading="loading"
      />
    </div>

    <!-- No Data State -->
    <div
      v-else-if="!loading"
      class="rounded-lg border border-dashed border-warning/30 bg-warning/5 p-4 text-center"
    >
      <UIcon name="i-lucide-alert-triangle" class="mx-auto size-8 text-warning" />
      <p class="mt-2 text-sm font-medium text-default">No analytics data available</p>
      <p class="mt-1 text-xs text-muted">
        Check that GA4 property IDs, GSC access, and PostHog keys are configured correctly. Force
        refresh to re-fetch from providers.
      </p>
    </div>
  </div>
</template>
