<script setup lang="ts">
const route = useRoute()
const appName = computed(() => String(route.params.app ?? ''))

useSeo({
  title: `${appName.value} — Fleet`,
  description: `Operational view for ${appName.value}: status and registry metadata.`,
})
useWebPageSchema({
  name: 'Fleet App Operations',
  description: 'Operational detail for a fleet app.',
})

const { rawApps, getAppStatus, refreshAppStatus } = useFleet({ includeInactive: true })

const appRecord = computed(() => rawApps.value.find((app) => app.name === appName.value) ?? null)
const statusRecord = computed(() => getAppStatus(appName.value))

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
          Registry and uptime. Charts and provider snapshots are on the Analytics page.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          :to="`/analytics/${appName}`"
          icon="i-lucide-chart-column-big"
          class="cursor-pointer"
        >
          Open Analytics
        </UButton>
        <FleetAppIndexnowButton :app-name="appName" />
        <FleetAppGscSitemapButton :app-name="appName" />
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

    <div v-if="appRecord" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
    </div>
  </div>
</template>
