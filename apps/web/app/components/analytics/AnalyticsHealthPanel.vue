<script setup lang="ts">
import type { AnalyticsInsight, FleetAnalyticsSnapshot } from '~/types/analytics'
import type { FleetRegistryApp } from '~/types/fleet'

interface HealthIssue {
  app: string
  provider: string
  severity: 'critical' | 'warning' | 'info'
  message: string
}

const props = defineProps<{
  apps: FleetRegistryApp[]
  snapshotMap: Record<string, FleetAnalyticsSnapshot | null>
  insights: AnalyticsInsight[]
  loading?: boolean
}>()

const isCollapsed = ref(false)

function providerSeverity(status: string): HealthIssue['severity'] | null {
  switch (status) {
    case 'missing_registry':
    case 'missing_config':
    case 'access_denied':
    case 'error':
      return 'critical'
    case 'stale':
      return 'warning'
    default:
      return null
  }
}

const issues = computed<HealthIssue[]>(() => {
  const list: HealthIssue[] = []

  for (const app of props.apps) {
    const snapshot = props.snapshotMap[app.name]
    if (!snapshot) continue

    for (const provider of [
      { key: 'ga', label: 'GA4', message: snapshot.ga.message, status: snapshot.ga.status },
      { key: 'gsc', label: 'GSC', message: snapshot.gsc.message, status: snapshot.gsc.status },
      {
        key: 'posthog',
        label: 'PostHog',
        message: snapshot.posthog.message,
        status: snapshot.posthog.status,
      },
      {
        key: 'indexnow',
        label: 'IndexNow',
        message: snapshot.indexnow.message,
        status: snapshot.indexnow.status,
      },
    ]) {
      const severity = providerSeverity(provider.status)
      if (!severity) continue
      list.push({
        app: app.name,
        provider: provider.label,
        severity,
        message: provider.message ?? `${provider.label} needs attention.`,
      })
    }
  }

  return list
})

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
  <UCard v-if="issues.length || insights.length || loading" class="mb-6 bg-elevated/30">
    <template #header>
      <UButton
        variant="ghost"
        color="neutral"
        class="flex w-full items-center justify-between gap-2 text-left -mx-2 cursor-pointer"
        @click="isCollapsed = !isCollapsed"
      >
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-heart-pulse" class="size-5 text-primary" />
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
          class="size-4 text-muted"
        />
      </UButton>
    </template>

    <div v-if="!isCollapsed" class="space-y-3">
      <div
        v-if="loading && !issues.length && !insights.length"
        class="flex items-center gap-2 text-sm text-muted"
      >
        <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
        Analyzing provider health…
      </div>

      <ul v-if="issues.length" class="space-y-2">
        <li
          v-for="issue in issues"
          :key="`${issue.app}-${issue.provider}-${issue.message}`"
          class="flex flex-col gap-1 rounded-xl border border-default/60 bg-default/5 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div class="flex items-start gap-2">
            <UIcon
              :name="iconFor(issue.severity)"
              :class="['mt-0.5 size-4', toneFor(issue.severity)]"
            />
            <div>
              <p class="text-sm text-default">
                <span class="font-medium">{{ issue.provider }}:</span>
                {{ issue.message }}
              </p>
            </div>
          </div>
          <NuxtLink
            :to="`/analytics/${issue.app}`"
            class="text-xs font-medium text-primary hover:underline"
          >
            {{ issue.app }}
          </NuxtLink>
        </li>
      </ul>

      <USeparator v-if="issues.length && insights.length" />

      <ul v-if="insights.length" class="space-y-2">
        <li
          v-for="insight in insights"
          :key="`${insight.appName}-${insight.message}`"
          class="flex flex-col gap-1 rounded-xl border border-default/60 bg-default/5 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div class="flex items-start gap-2">
            <UIcon
              :name="iconFor(insight.severity)"
              :class="['mt-0.5 size-4', toneFor(insight.severity)]"
            />
            <p class="text-sm text-default">{{ insight.message }}</p>
          </div>
          <NuxtLink
            :to="`/analytics/${insight.appName}`"
            class="text-xs font-medium text-primary hover:underline"
          >
            {{ insight.appName }}
          </NuxtLink>
        </li>
      </ul>
    </div>
  </UCard>
</template>
