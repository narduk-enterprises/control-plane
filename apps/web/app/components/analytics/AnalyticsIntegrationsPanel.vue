<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAnalyticsStore } from '~/stores/analytics'

const analyticsStore = useAnalyticsStore()
const { integrationHealth, integrationHealthError, integrationHealthStatus } =
  storeToRefs(analyticsStore)

const integrations = computed(() => {
  const health = integrationHealth.value
  if (!health) return []

  return [
    {
      name: 'Google Service Account',
      icon: 'i-lucide-key-round',
      status:
        health.services.find((service) => service.key === 'google_service_account')?.status ??
        'missing',
      hint:
        health.services.find((service) => service.key === 'google_service_account')?.message ??
        'Missing',
    },
    {
      name: 'GA Provisioning',
      icon: 'i-lucide-activity',
      status:
        health.services.find((service) => service.key === 'ga_account_id')?.status ?? 'missing',
      hint:
        health.services.find((service) => service.key === 'ga_account_id')?.message ?? 'Missing',
    },
    {
      name: 'PostHog API',
      icon: 'i-lucide-waveform',
      status: health.services.find((service) => service.key === 'posthog')?.status ?? 'missing',
      hint: health.services.find((service) => service.key === 'posthog')?.message ?? 'Missing',
    },
  ]
})

function integrationBadgeColor(status: string) {
  switch (status) {
    case 'configured':
      return 'success'
    case 'partial':
      return 'warning'
    default:
      return 'neutral'
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-sm font-semibold text-default">Server integrations</h2>
      <p class="text-xs text-muted">Secrets and API reachability for snapshot pipelines</p>
    </template>

    <div
      v-if="integrationHealthStatus === 'pending' || integrationHealthStatus === 'idle'"
      class="mb-4 flex items-center gap-2 text-sm text-muted"
    >
      <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
      Checking integration health…
    </div>
    <UAlert
      v-else-if="integrationHealthError"
      icon="i-lucide-alert-circle"
      title="Integration health could not be loaded"
      :description="integrationHealthError"
      color="error"
      variant="subtle"
      class="mb-4"
    />
    <ul v-else-if="integrations.length" class="space-y-3">
      <li
        v-for="int in integrations"
        :key="int.name"
        class="flex items-center justify-between rounded-lg border border-default px-4 py-3 transition-colors hover:bg-elevated/50"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <UIcon :name="int.icon" class="size-5" />
          </div>
          <div>
            <p class="font-medium text-default">{{ int.name }}</p>
            <p class="text-sm text-muted">{{ int.hint }}</p>
          </div>
        </div>
        <UBadge :color="integrationBadgeColor(int.status)" variant="soft">
          {{ int.status }}
        </UBadge>
      </li>
    </ul>

    <div
      v-if="integrationHealth && integrationHealthStatus === 'success'"
      class="mt-4 grid gap-3 rounded-xl border border-default/60 bg-elevated/30 p-4 md:grid-cols-3"
    >
      <div>
        <p class="text-xs uppercase tracking-[0.12em] text-muted">Fleet apps</p>
        <p class="mt-1 text-lg font-semibold text-default">
          {{ integrationHealth.fleet.totalApps }}
        </p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-[0.12em] text-muted">GA measurement IDs</p>
        <p class="mt-1 text-lg font-semibold text-default">
          {{ integrationHealth.fleet.appsWithGaMeasurementId }}/{{
            integrationHealth.fleet.totalApps
          }}
        </p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-[0.12em] text-muted">Last snapshot</p>
        <p class="mt-1 text-sm font-medium text-default">
          {{
            integrationHealth.lastSnapshotAt
              ? new Date(integrationHealth.lastSnapshotAt).toLocaleString()
              : 'No canonical snapshot yet'
          }}
        </p>
      </div>
    </div>
  </UCard>
</template>
