<script setup lang="ts">
import { useAnalyticsStore } from '~/stores/analytics'

const route = useRoute()
const appName = computed(() => String(route.params.app ?? ''))

useSeo({
  title: `${appName.value} — Fleet`,
  description: `Operational view for ${appName.value}: status, registry metadata, and provider health.`,
})
useWebPageSchema({
  name: 'Fleet App Operations',
  description: 'Operational detail for a fleet app.',
})

const analyticsStore = useAnalyticsStore()
const { rawApps, getAppStatus, refreshAppStatus } = useFleet({ includeInactive: true })

const appRecord = computed(() => rawApps.value.find((app) => app.name === appName.value) ?? null)
const statusRecord = computed(() => getAppStatus(appName.value))
const thirtyDayRange = computed(() => {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 30)
  return {
    startDate: start.toISOString().split('T')[0] ?? '',
    endDate: end.toISOString().split('T')[0] ?? '',
  }
})
const snapshot = computed(() => analyticsStore.getDetail(appName.value, thirtyDayRange.value))

onMounted(() => {
  if (appName.value) {
    void analyticsStore.fetchDetail(appName.value, { range: thirtyDayRange.value })
  }
})

function badgeColor(status: string | undefined) {
  switch (status) {
    case 'healthy':
      return 'success'
    case 'stale':
      return 'warning'
    case 'missing_registry':
    case 'missing_config':
    case 'access_denied':
    case 'error':
      return 'error'
    default:
      return 'neutral'
  }
}

const providerCards = computed(() => {
  if (!snapshot.value) return []
  return [
    { label: 'GA4', status: snapshot.value.ga.status, message: snapshot.value.ga.message },
    { label: 'GSC', status: snapshot.value.gsc.status, message: snapshot.value.gsc.message },
    {
      label: 'PostHog',
      status: snapshot.value.posthog.status,
      message: snapshot.value.posthog.message,
    },
    {
      label: 'IndexNow',
      status: snapshot.value.indexnow.status,
      message: snapshot.value.indexnow.message,
    },
  ]
})

const breadcrumbItems = computed(() => [
  { label: 'Dashboard', to: '/' },
  { label: 'Fleet', to: '/fleet' },
  { label: appName.value },
])
</script>

<template>
  <div class="space-y-6">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 class="font-display text-2xl font-semibold text-default">{{ appName }}</h1>
        <p class="mt-1 text-sm text-muted">
          Operational view. Open the analytics snapshot for charts and metric drilldowns.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          :to="`/analytics/${appName}`"
          icon="i-lucide-chart-column-big"
          class="cursor-pointer"
        >
          Open Analytics
        </UButton>
        <UButton
          variant="outline"
          color="neutral"
          icon="i-lucide-refresh-cw"
          class="cursor-pointer"
          @click="refreshAppStatus(appName)"
        >
          Refresh Status
        </UButton>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <UCard>
        <template #header>
          <h2 class="text-sm font-medium text-default">Status</h2>
        </template>
        <FleetAppStatus :app-status="statusRecord" />
      </UCard>
      <UCard v-if="appRecord">
        <template #header>
          <h2 class="text-sm font-medium text-default">URL</h2>
        </template>
        <ULink :to="appRecord.url" target="_blank" class="text-primary hover:underline">
          {{ appRecord.url }}
        </ULink>
      </UCard>
      <UCard v-if="appRecord">
        <template #header>
          <h2 class="text-sm font-medium text-default">Doppler Project</h2>
        </template>
        <p class="font-medium text-default">{{ appRecord.dopplerProject }}</p>
      </UCard>
      <UCard v-if="appRecord?.githubRepo">
        <template #header>
          <h2 class="text-sm font-medium text-default">GitHub Repo</h2>
        </template>
        <p class="font-medium text-default">{{ appRecord.githubRepo }}</p>
      </UCard>
    </div>

    <div v-if="appRecord" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <UCard>
        <template #header>
          <h2 class="text-sm font-medium text-default">GA Property ID</h2>
        </template>
        <p class="font-medium text-default">{{ appRecord.gaPropertyId || 'Not set' }}</p>
      </UCard>
      <UCard>
        <template #header>
          <h2 class="text-sm font-medium text-default">GA Measurement ID</h2>
        </template>
        <p class="font-medium text-default">{{ appRecord.gaMeasurementId || 'Not set' }}</p>
      </UCard>
      <UCard>
        <template #header>
          <h2 class="text-sm font-medium text-default">PostHog App Name</h2>
        </template>
        <p class="font-medium text-default">
          {{ appRecord.posthogAppName || 'Host-based mapping' }}
        </p>
      </UCard>
      <UCard>
        <template #header>
          <h2 class="text-sm font-medium text-default">Snapshot Range</h2>
        </template>
        <p class="font-medium text-default">
          {{ thirtyDayRange.startDate }} to {{ thirtyDayRange.endDate }}
        </p>
      </UCard>
    </div>

    <div v-if="providerCards.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <UCard v-for="provider in providerCards" :key="provider.label">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-[0.12em] text-muted">{{ provider.label }}</p>
            <p class="mt-1 font-semibold text-default">{{ provider.status }}</p>
            <p class="mt-2 text-sm text-muted">{{ provider.message || 'No issues reported.' }}</p>
          </div>
          <UBadge :color="badgeColor(provider.status)" variant="soft" size="sm">
            {{ provider.status }}
          </UBadge>
        </div>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <h2 class="text-sm font-medium text-default">IndexNow</h2>
      </template>
      <FleetAppIndexnowPanel :app-name="appName" />
    </UCard>
  </div>
</template>
