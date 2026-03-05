<script setup lang="ts">
export interface AnalyticsInsight {
  type: 'spike' | 'drop' | 'milestone'
  severity: 'info' | 'warning' | 'critical'
  appName: string
  message: string
  metric: string
  currentValue?: number
  previousValue?: number
  delta?: number
}

const props = withDefaults(
  defineProps<{
    insights: AnalyticsInsight[]
    loading?: boolean
    collapsed?: boolean
  }>(),
  { collapsed: false },
)

const isCollapsed = ref(props.collapsed)

const severityIcon = (s: string) => {
  switch (s) {
    case 'critical':
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
      return 'text-error'
    case 'warning':
      return 'text-warning'
    default:
      return 'text-info'
  }
}
</script>

<template>
  <UCard v-if="insights.length > 0 || loading" class="mb-6 bg-elevated/30">
    <template #header>
      <UButton
        variant="ghost"
        color="neutral"
        class="flex w-full items-center justify-between gap-2 text-left cursor-pointer -mx-2"
        @click="isCollapsed = !isCollapsed"
      >
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-lightbulb" class="size-5 text-primary" />
          <h3 class="font-medium text-default">Insights</h3>
          <UBadge v-if="insights.length" variant="subtle" color="primary" size="sm">
            {{ insights.length }}
          </UBadge>
        </div>
        <UIcon :name="isCollapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'" class="size-4 text-muted" />
      </UButton>
    </template>
    <div v-if="!isCollapsed">
      <div v-if="loading && !insights.length" class="flex items-center gap-2 text-sm text-muted">
        <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
        Analyzing…
      </div>
      <ul v-else class="space-y-2">
        <li
          v-for="(insight, i) in insights"
          :key="i"
          class="flex items-start gap-2 rounded-lg border border-default/50 bg-default/30 px-3 py-2 text-sm"
        >
          <UIcon :name="severityIcon(insight.severity)" :class="['size-4 shrink-0', severityColor(insight.severity)]" />
          <span class="text-default">{{ insight.message }}</span>
          <NuxtLink
            :to="`/fleet/${insight.appName}`"
            class="shrink-0 font-medium text-primary hover:underline"
          >
            {{ insight.appName }}
          </NuxtLink>
        </li>
      </ul>
    </div>
  </UCard>
</template>
