<script setup lang="ts">
import type { AnalyticsInsight, FleetAnalyticsSnapshot } from '~/types/analytics'
import type { FleetRegistryApp } from '~/types/fleet'
import {
  analyticsSurfaceHref,
  buildAnalyticsInsightGroups,
  buildAnalyticsIssueGroups,
} from '~/utils/analyticsPresentation'

const props = defineProps<{
  apps: FleetRegistryApp[]
  snapshotMap: Record<string, FleetAnalyticsSnapshot | null>
  insights: AnalyticsInsight[]
  loading?: boolean
  /** Background revalidation while showing the last snapshot */
  revalidating?: boolean
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const isCollapsed = ref(false)

const issues = computed(() => buildAnalyticsIssueGroups(props.apps, props.snapshotMap))
const insightGroups = computed(() => buildAnalyticsInsightGroups(props.insights))

const counts = computed(() => ({
  critical: issues.value.filter((issue) => issue.severity === 'critical').length,
  warning: issues.value.filter((issue) => issue.severity === 'warning').length,
}))

function iconFor(severity: string) {
  switch (severity) {
    case 'critical':
      return 'i-lucide-octagon-alert'
    case 'warning':
      return 'i-lucide-triangle-alert'
    default:
      return 'i-lucide-info'
  }
}

function toneFor(severity: string) {
  switch (severity) {
    case 'critical':
      return 'text-error'
    case 'warning':
      return 'text-warning'
    default:
      return 'text-info'
  }
}
</script>

<template>
  <UCard v-if="issues.length || insightGroups.length || loading" class="mb-6 bg-elevated/30">
    <template #header>
      <div class="flex w-full items-center gap-1 -mx-2">
        <UButton
          variant="ghost"
          color="neutral"
          class="flex min-w-0 flex-1 items-center justify-between gap-2 text-left cursor-pointer"
          @click="isCollapsed = !isCollapsed"
        >
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <UIcon name="i-lucide-heart-pulse" class="size-5 shrink-0 text-primary" />
            <span class="font-medium text-default">Fleet Health</span>
            <UBadge v-if="counts.critical > 0" color="error" variant="subtle" size="sm">
              {{ counts.critical }} critical
            </UBadge>
            <UBadge v-if="counts.warning > 0" color="warning" variant="subtle" size="sm">
              {{ counts.warning }} warning{{ counts.warning === 1 ? '' : 's' }}
            </UBadge>
          </div>
          <UIcon
            :name="isCollapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
            class="size-4 shrink-0 text-muted"
          />
        </UButton>
        <UTooltip text="Refresh fleet health">
          <UButton
            icon="i-lucide-refresh-cw"
            variant="ghost"
            color="neutral"
            size="sm"
            class="shrink-0"
            :loading="loading"
            :disabled="loading"
            aria-label="Refresh fleet health"
            @click.stop="emit('refresh')"
          />
        </UTooltip>
      </div>
    </template>

    <div v-if="!isCollapsed" class="space-y-3">
      <div
        v-if="revalidating && (issues.length || insightGroups.length)"
        class="flex items-center gap-2 text-xs text-muted"
      >
        <UIcon name="i-lucide-loader-2" class="size-3.5 animate-spin" />
        Refreshing provider snapshot…
      </div>

      <div
        v-if="loading && !issues.length && !insightGroups.length"
        class="flex items-center gap-2 text-sm text-muted"
      >
        <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
        Analyzing provider health…
      </div>

      <ul v-if="issues.length" class="space-y-2">
        <li
          v-for="issue in issues"
          :key="issue.id"
          class="flex flex-col gap-1 rounded-xl border border-default/60 bg-default/5 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-start gap-2">
              <UIcon
                :name="iconFor(issue.severity)"
                :class="['mt-0.5 size-4', toneFor(issue.severity)]"
              />
              <div class="min-w-0">
                <p class="text-sm text-default">
                  <span class="font-medium">{{ issue.label }}:</span>
                  {{ issue.message }}
                </p>
                <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <UBadge
                    :color="issue.severity === 'critical' ? 'error' : 'warning'"
                    variant="subtle"
                    size="sm"
                  >
                    {{ issue.appCount }} app{{ issue.appCount === 1 ? '' : 's' }}
                  </UBadge>
                  <NuxtLink
                    :to="analyticsSurfaceHref(issue.surface)"
                    class="font-medium text-primary hover:underline"
                  >
                    Open {{ issue.label }}
                  </NuxtLink>
                </div>
                <div class="mt-2 flex flex-wrap gap-2">
                  <NuxtLink
                    v-for="appName in issue.apps.slice(0, 5)"
                    :key="`${issue.id}-${appName}`"
                    :to="analyticsSurfaceHref(issue.surface, appName)"
                    class="rounded-full border border-default/70 px-2.5 py-1 text-xs text-muted hover:border-primary/40 hover:text-primary"
                  >
                    {{ appName }}
                  </NuxtLink>
                  <span v-if="issue.appCount > 5" class="text-xs text-muted">
                    +{{ issue.appCount - 5 }} more
                  </span>
                </div>
              </div>
            </div>
          </div>
        </li>
      </ul>

      <USeparator v-if="issues.length && insightGroups.length" />

      <ul v-if="insightGroups.length" class="space-y-2">
        <li
          v-for="insight in insightGroups"
          :key="insight.id"
          class="flex flex-col gap-1 rounded-xl border border-default/60 bg-default/5 px-3 py-3"
        >
          <div class="flex items-start gap-2">
            <UIcon
              :name="iconFor(insight.severity)"
              :class="['mt-0.5 size-4', toneFor(insight.severity)]"
            />
            <div class="min-w-0">
              <p class="text-sm text-default">{{ insight.message }}</p>
              <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <UBadge
                  :color="insight.severity === 'critical' ? 'error' : insight.severity === 'warning' ? 'warning' : 'neutral'"
                  variant="subtle"
                  size="sm"
                >
                  {{ insight.metric }}
                </UBadge>
                <UBadge color="neutral" variant="soft" size="sm">
                  {{ insight.appCount }} app{{ insight.appCount === 1 ? '' : 's' }}
                </UBadge>
              </div>
              <div class="mt-2 flex flex-wrap gap-2">
                <NuxtLink
                  v-for="appName in insight.apps.slice(0, 5)"
                  :key="`${insight.id}-${appName}`"
                  :to="analyticsSurfaceHref('overview', appName)"
                  class="rounded-full border border-default/70 px-2.5 py-1 text-xs text-muted hover:border-primary/40 hover:text-primary"
                >
                  {{ appName }}
                </NuxtLink>
                <span v-if="insight.appCount > 5" class="text-xs text-muted">
                  +{{ insight.appCount - 5 }} more
                </span>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </UCard>
</template>
