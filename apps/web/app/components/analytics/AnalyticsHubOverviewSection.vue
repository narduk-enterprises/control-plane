<script setup lang="ts">
import type {
  AnalyticsInsight,
  FleetAnalyticsSnapshot,
  FleetAnalyticsSummaryResponse,
} from '~/types/analytics'
import type { FleetRegistryApp } from '~/types/fleet'

defineProps<{
  apps: FleetRegistryApp[]
  snapshotMap: Record<string, FleetAnalyticsSnapshot | null>
  insights: AnalyticsInsight[]
  loading: boolean
  summaryRevalidating: boolean
  summary: FleetAnalyticsSummaryResponse | null
}>()

const emit = defineEmits<{
  (e: 'refreshFleetHealth'): void
}>()
</script>

<template>
  <div class="space-y-6">
    <AnalyticsIntegrationsPanel />
    <AnalyticsHealthPanel
      :apps="apps"
      :snapshot-map="snapshotMap"
      :insights="insights"
      :loading="loading"
      :revalidating="summaryRevalidating"
      @refresh="emit('refreshFleetHealth')"
    />
    <AnalyticsFleetBanner :summary="summary" :loading="loading" />
  </div>
</template>
