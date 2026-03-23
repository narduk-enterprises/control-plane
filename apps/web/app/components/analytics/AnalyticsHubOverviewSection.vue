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
  summary: FleetAnalyticsSummaryResponse | null
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
    />
    <AnalyticsFleetBanner :summary="summary" :loading="loading" />
  </div>
</template>
