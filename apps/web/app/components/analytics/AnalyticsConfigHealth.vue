<script setup lang="ts">
/**
 * AnalyticsConfigHealth — surfaces actual misconfigurations
 * across the fleet. Focuses on real issues:
 * - GA4: missing property ID (can't fetch data)
 * - GA4: zero data returned (service account may lack access)
 * - Summary: no cached data returned (needs force refresh)
 *
 * PostHog uses $host from the app URL, not posthogAppName, so
 * we do NOT warn about missing posthogAppName — it's cosmetic.
 */
import type { FleetApp } from '~/composables/useFleet'
import type { FleetAppAnalyticsSummary } from '~/composables/useFleetAnalyticsSummary'

const props = defineProps<{
  apps: FleetApp[]
  summaryMap: Record<string, FleetAppAnalyticsSummary>
  loading?: boolean
}>()

interface ConfigIssue {
  app: string
  severity: 'error' | 'warning' | 'info'
  provider: 'GA4' | 'GSC' | 'PostHog' | 'System'
  message: string
  action?: string
}

const issues = computed<ConfigIssue[]>(() => {
  const list: ConfigIssue[] = []

  // Count provider data availability for fleet-wide summary
  let appsWithGAData = 0
  let appsWithGSCData = 0
  let _appsWithPHData = 0

  for (const app of props.apps) {
    const summary = props.summaryMap?.[app.name]

    // ── GA4 checks ──
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
      // Check for zero data (might be wrong property ID or no access)
      const s = summary.ga.summary
      if (s.activeUsers === 0 && s.screenPageViews === 0) {
        list.push({
          app: app.name,
          severity: 'warning',
          provider: 'GA4',
          message: `Property ${app.gaPropertyId} returned zero users and pageviews`,
          action:
            'Verify the property ID matches the correct site, or check service account access',
        })
      }
    }

    // ── GSC checks ──
    if (!props.loading && summary?.gsc?.totals) {
      appsWithGSCData++
    }

    // ── PostHog checks ──
    if (!props.loading && summary?.posthog?.summary) {
      _appsWithPHData++
    }
  }

  // Fleet-wide diagnostic if no GA data at all
  if (!props.loading && props.apps.length > 0 && appsWithGAData === 0 && appsWithGSCData === 0) {
    list.unshift({
      app: 'fleet',
      severity: 'warning',
      provider: 'System',
      message: `No GA4 or GSC data for any of ${props.apps.length} apps — service account may lack access to GA4 properties`,
      action:
        'Grant the service account Viewer role in GA4 Admin → Property Access Management for each property',
    })
  }

  return list
})

const errorCount = computed(() => issues.value.filter((i) => i.severity === 'error').length)
const warningCount = computed(() => issues.value.filter((i) => i.severity === 'warning').length)
const infoCount = computed(() => issues.value.filter((i) => i.severity === 'info').length)
const isCollapsed = ref(true)

const severityIcon: Record<string, string> = {
  error: 'i-lucide-alert-octagon',
  warning: 'i-lucide-alert-triangle',
  info: 'i-lucide-info',
}

const severityColor: Record<string, string> = {
  error: 'text-error',
  warning: 'text-warning',
  info: 'text-info',
}
</script>

<template>
  <UCard v-if="issues.length > 0" class="mb-6">
    <template #header>
      <UButton
        variant="ghost"
        color="neutral"
        class="flex w-full items-center justify-between gap-2 text-left cursor-pointer -mx-2"
        @click="isCollapsed = !isCollapsed"
      >
        <div class="flex items-center gap-2">
          <UIcon
            name="i-lucide-shield-check"
            :class="errorCount > 0 ? 'text-error' : warningCount > 0 ? 'text-warning' : 'text-info'"
            class="size-5"
          />
          <h3 class="font-medium text-default">Config Health</h3>
          <UBadge v-if="errorCount" color="error" variant="subtle" size="sm">
            {{ errorCount }} {{ errorCount === 1 ? 'error' : 'errors' }}
          </UBadge>
          <UBadge v-if="warningCount" color="warning" variant="subtle" size="sm">
            {{ warningCount }} {{ warningCount === 1 ? 'warning' : 'warnings' }}
          </UBadge>
          <UBadge v-if="infoCount" color="info" variant="subtle" size="sm">
            {{ infoCount }} skipped
          </UBadge>
        </div>
        <UIcon
          :name="isCollapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
          class="size-4 text-muted"
        />
      </UButton>
    </template>
    <ul v-if="!isCollapsed" class="space-y-2">
      <li
        v-for="(issue, i) in issues"
        :key="i"
        class="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 rounded-lg border border-default/50 bg-default/30 px-3 py-2 text-sm"
      >
        <div class="flex items-start gap-2 flex-1 min-w-0">
          <UIcon
            :name="severityIcon[issue.severity] ?? 'i-lucide-info'"
            :class="['size-4 shrink-0 mt-0.5', severityColor[issue.severity] ?? 'text-muted']"
          />
          <div class="min-w-0">
            <span class="text-default">{{ issue.message }}</span>
            <p v-if="issue.action" class="text-xs text-muted mt-0.5">→ {{ issue.action }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0 pl-6 sm:pl-0">
          <UBadge variant="subtle" color="neutral" size="xs">{{ issue.provider }}</UBadge>
          <NuxtLink
            v-if="issue.app !== 'fleet'"
            :to="`/fleet/${issue.app}`"
            class="font-medium text-primary hover:underline text-xs"
          >
            {{ issue.app }}
          </NuxtLink>
        </div>
      </li>
    </ul>
  </UCard>
</template>
