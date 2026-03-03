<script setup lang="ts">
useSeo({
  title: 'Narduk Control Plane',
  description: 'Fleet dashboard for narduk-enterprises apps — GSC, PostHog, IndexNow, and Google Indexing.',
  ogImage: { title: 'Narduk Control Plane', description: 'Fleet dashboard.', icon: '⚙️' },
})
useWebPageSchema({
  name: 'Narduk Control Plane',
  description: 'Fleet dashboard for narduk-enterprises apps.',
})

const { apps, refreshApps } = useFleetDashboard()
const { data: indexingPublishData, error: indexingPublishError, loading: loadingIndexing, submitUrl } = useIndexingPublish()
const { data: indexingStatusData, error: indexingStatusError, loading: loadingStatus, checkStatus } = useIndexingStatus()

const indexingUrl = ref('')
const indexingStatusUrl = ref('')

async function onSubmitIndexing() {
  if (!indexingUrl.value) return
  await submitUrl(indexingUrl.value)
}

async function onCheckIndexingStatus() {
  if (!indexingStatusUrl.value) return
  await checkStatus(indexingStatusUrl.value)
}

const indexingResultJson = computed(() => {
  const raw = indexingPublishError.value ? { error: indexingPublishError.value?.message } : indexingPublishData.value
  return raw ? JSON.stringify(raw, null, 2) : ''
})
const indexingStatusJson = computed(() => {
  const raw = indexingStatusError.value ? { error: indexingStatusError.value?.message } : indexingStatusData.value
  return raw ? JSON.stringify(raw, null, 2) : ''
})

const fleetApps = computed(() => apps.value ?? [])
const hasFleetApps = computed(() => fleetApps.value.length > 0)
</script>

<template>
  <UPage>
    <UPageHeader
      title="Narduk Control Plane"
      description="Fleet dashboard — GSC, PostHog, IndexNow, and Google Indexing."
    >
      <template #links>
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-refresh-cw"
          @click="refreshApps()"
        >
          Refresh
        </UButton>
      </template>
    </UPageHeader>

    <UPageBody>
      <!-- Google Indexing (global) -->
      <UCard class="mb-6">
        <template #header>
          <h2 class="font-semibold">Google Indexing API</h2>
        </template>
        <div class="flex flex-col gap-4">
          <div class="flex flex-wrap items-end gap-2">
            <UFormField label="URL to submit">
              <UInput
                v-model="indexingUrl"
                placeholder="https://example.com/page"
                class="min-w-64"
              />
            </UFormField>
            <UButton
              :loading="loadingIndexing"
              @click="onSubmitIndexing"
            >
              Submit URL
            </UButton>
          </div>
          <div v-if="indexingResultJson" class="rounded-lg bg-muted p-3 text-sm">
            <pre class="whitespace-pre-wrap">{{ indexingResultJson }}</pre>
          </div>
          <USeparator />
          <div class="flex flex-wrap items-end gap-2">
            <UFormField label="URL to check status">
              <UInput
                v-model="indexingStatusUrl"
                placeholder="https://example.com/page"
                class="min-w-64"
              />
            </UFormField>
            <UButton
              :loading="loadingStatus"
              variant="outline"
              @click="onCheckIndexingStatus"
            >
              Check status
            </UButton>
          </div>
          <div v-if="indexingStatusJson" class="rounded-lg bg-muted p-3 text-sm">
            <pre class="whitespace-pre-wrap">{{ indexingStatusJson }}</pre>
          </div>
        </div>
      </UCard>

      <!-- Fleet apps -->
      <h2 class="font-semibold mb-3">Fleet apps</h2>
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <UCard
          v-for="app in fleetApps"
          :key="app.name"
          class="flex flex-col"
        >
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-medium">{{ app.name }}</span>
              <UButton
                :to="app.url"
                target="_blank"
                rel="noopener"
                variant="ghost"
                size="xs"
                icon="i-lucide-external-link"
              />
            </div>
          </template>
          <p class="text-sm text-muted mb-4 truncate">{{ app.url }}</p>
          <div class="flex flex-wrap gap-2 mt-auto">
            <FleetAppGscButton :app-name="app.name" />
            <FleetAppPosthogButton :app-name="app.name" />
            <FleetAppIndexnowButton :app-name="app.name" />
          </div>
        </UCard>
      </div>
      <p v-if="!hasFleetApps" class="text-muted text-sm">No apps. Ensure you are authenticated and /api/fleet/apps returns data.</p>
    </UPageBody>
  </UPage>
</template>
