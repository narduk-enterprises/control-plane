<script setup lang="ts">
import type { FleetAppAnalyticsSummary } from '~/composables/useFleetAnalyticsSummary'
import type { AnalyticsInsight } from '~/types/analytics'
import type { FleetApp } from '~/composables/useFleet'

/**
 * AnalyticsHealthPanel — unified config health + data insights.
 * Shows configuration errors (missing GA property IDs, zero data) alongside
 * trend insights (traffic spikes/drops) in one collapsible panel.
 */

interface ConfigIssue {
  app: string
  severity: 'error' | 'warning' | 'info'
  provider: string
  message: string
  action?: string
}

const props = defineProps<{
  apps: FleetApp[]
  summaryMap: Record<string, FleetAppAnalyticsSummary>
  insights: AnalyticsInsight[]
  loading?: boolean
  insightsLoading?: boolean
}>()

const isCollapsed = ref(false)

// ── Config issues (computed from fleet apps + summary data) ──
const configIssues = computed<ConfigIssue[]>(() => {
  const list: ConfigIssue[] = []
  let appsWithGAData = 0
  let appsWithGSCData = 0

  for (const app of props.apps) {
    const summary = props.summaryMap?.[app.name]

    if (!app.gaPropertyId) {
      list.push({
        app: app.name,
        severity: 'error',
        provider: 'GA4',
        message: 'No GA4 property ID configured',
        action: 'Add via /fleet/manage or provision API',
      })
    } else if (!props.loading && summary?.ga?.summary) {
      appsWithGAData++
      const s = summary.ga.summary
      if (s.activeUsers === 0 && s.screenPageViews === 0) {
        list.push({
          app: app.name,
          severity: 'warning',
          provider: 'GA4',
          message: `Property ${app.gaPropertyId} returned zero data`,
          action: 'Check service account access or verify property ID',
        })
      }
    }

    if (!props.loading && summary?.gsc?.totals) {
      appsWithGSCData++
    }
  }

  // Fleet-wide diagnostic if zero providers have data
  if (!props.loading && props.apps.length > 0 && appsWithGAData === 0 && appsWithGSCData === 0) {
    list.unshift({
      app: 'fleet',
      severity: 'warning',
      provider: 'System',
      message: `No GA4 or GSC data for any of ${props.apps.length} apps`,
      action: 'Grant service account Viewer role in GA4 properties, then force refresh',
    })
  }

  return list
})

const errorCount = computed(() => configIssues.value.filter((i) => i.severity === 'error').length)
const warnCount = computed(() => configIssues.value.filter((i) => i.severity === 'warning').length)
const totalItems = computed(() => configIssues.value.length + props.insights.length)

const severityIcon = (s: string) => {
  switch (s) {
    case 'critical':
    case 'error':
      return 'i-lucide-alert-octagon'
    case 'warning':
      return 'i-lucide-alert-triangle'
    default:
      return 'i-lucide-info'
  }
}

const severityColor = (s: string) => {
  switch (s) {
    case 'critical':
    case 'error':
      return 'text-error'
    case 'warning':
      return 'text-warning'
    default:
      return 'text-info'
  }
}
</script>

<template>
  <UCard v-if="totalItems > 0 || loading || insightsLoading" class="mb-6 bg-elevated/30">
    <template #header>
      <UButton
        variant="ghost"
        color="neutral"
        class="flex w-full items-center justify-between gap-2 text-left cursor-pointer -mx-2"
        @click="isCollapsed = !isCollapsed"
      >
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-heart-pulse" class="size-5 text-primary" />
          <h3 class="font-medium text-default">Fleet Health</h3>
          <UBadge v-if="errorCount > 0" variant="subtle" color="error" size="sm">
            {{ errorCount }} {{ errorCount === 1 ? 'error' : 'errors' }}
          </UBadge>
          <UBadge v-if="warnCount > 0" variant="subtle" color="warning" size="sm">
            {{ warnCount }} {{ warnCount === 1 ? 'warning' : 'warnings' }}
          </UBadge>
          <UBadge
            v-if="errorCount === 0 && warnCount === 0 && totalItems > 0"
            variant="subtle"
            color="info"
            size="sm"
          >
            {{ totalItems }}
          </UBadge>
        </div>
        <UIcon
          :name="isCollapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
          class="size-4 text-muted"
        />
      </UButton>
    </template>

    <div v-if="!isCollapsed">
      <!-- Loading state -->
      <div
        v-if="(loading || insightsLoading) && totalItems === 0"
        class="flex items-center gap-2 text-sm text-muted"
      >
        <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
        Analyzing fleet…
      </div>

      <!-- Config issues -->
      <ul v-if="configIssues.length" class="space-y-2">
        <li
          v-for="(issue, i) in configIssues"
          :key="`cfg-${i}`"
          class="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 rounded-lg border border-default/50 bg-default/30 px-3 py-2 text-sm"
        >
          <div class="flex items-start gap-2 min-w-0 flex-1">
            <UIcon
              :name="severityIcon(issue.severity)"
              :class="['size-4 shrink-0 mt-0.5', severityColor(issue.severity)]"
            />
            <div class="min-w-0">
              <span class="text-default break-words">{{ issue.message }}</span>
              <span v-if="issue.action" class="block text-xs text-muted mt-0.5">
                {{ issue.action }}
              </span>
            </div>
          </div>
          <NuxtLink
            v-if="issue.app !== 'fleet'"
            :to="`/fleet/${issue.app}`"
            class="shrink-0 font-medium text-primary hover:underline text-xs pl-6 sm:pl-0"
          >
            {{ issue.app }}
          </NuxtLink>
        </li>
      </ul>

      <!-- Insights separator -->
      <USeparator v-if="configIssues.length && insights.length" class="my-3" />

      <!-- Trend insights -->
      <ul v-if="insights.length" class="space-y-2">
        <li
          v-for="(insight, i) in insights"
          :key="`ins-${i}`"
          class="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 rounded-lg border border-default/50 bg-default/30 px-3 py-2 text-sm"
        >
          <div class="flex items-start gap-2 min-w-0 flex-1">
            <UIcon
              :name="severityIcon(insight.severity)"
              :class="['size-4 shrink-0 mt-0.5', severityColor(insight.severity)]"
            />
            <span class="text-default break-words min-w-0">{{ insight.message }}</span>
          </div>
          <NuxtLink
            :to="`/fleet/${insight.appName}`"
            class="shrink-0 font-medium text-primary hover:underline text-xs pl-6 sm:pl-0"
          >
            {{ insight.appName }}
          </NuxtLink>
        </li>
      </ul>
    </div>
  </UCard>
</template>
