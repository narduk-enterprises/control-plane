<script setup lang="ts">
import type { AnalyticsProviderStatus } from '~/types/analytics'
import { providerStatusColor, providerStatusText } from '~/utils/analyticsPresentation'

defineProps<{
  appName: string
  href: string
  status: AnalyticsProviderStatus
  message?: string | null
  hint?: string | null
  metrics?: Array<{
    label: string
    value: string
  }>
  actionLabel?: string
}>()
</script>

<template>
  <UCard class="rounded-2xl border border-default/70 bg-elevated/25">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <NuxtLink
          :to="href"
          class="truncate text-base font-semibold text-default hover:text-primary"
        >
          {{ appName }}
        </NuxtLink>
        <p v-if="hint" class="mt-1 truncate text-xs text-muted">{{ hint }}</p>
      </div>
      <UBadge :color="providerStatusColor(status)" variant="soft" size="sm">
        {{ providerStatusText(status) }}
      </UBadge>
    </div>

    <p class="mt-3 text-sm leading-6 text-muted">
      {{ message || 'No provider note was returned for this app.' }}
    </p>

    <div
      v-if="metrics?.length"
      class="mt-4 grid gap-2 rounded-xl border border-default/60 bg-default/40 p-3 sm:grid-cols-3"
    >
      <div v-for="metric in metrics" :key="metric.label">
        <p class="text-[11px] uppercase tracking-[0.12em] text-muted">{{ metric.label }}</p>
        <p class="mt-1 text-sm font-semibold text-default">{{ metric.value }}</p>
      </div>
    </div>

    <div class="mt-4">
      <NuxtLink :to="href" class="text-sm font-medium text-primary hover:underline">
        {{ actionLabel || 'Open detail view' }}
      </NuxtLink>
    </div>
  </UCard>
</template>
