<script setup lang="ts">
useSeo({
  title: 'Indexing',
  description: 'Google Indexing API — submit URLs and check status.',
})
useWebPageSchema({
  name: 'Narduk Control Plane — Indexing',
  description: 'Google Indexing API tools.',
})

const { data: indexingPublishData, error: indexingPublishError, loading: loadingIndexing, submitUrl } = useIndexingPublish()
const { data: indexingStatusData, error: indexingStatusError, loading: loadingStatus, checkStatus } = useIndexingStatus()

const toast = useToast()

const indexingUrl = ref('')
const indexingStatusUrl = ref('')
const indexingType = ref<'URL_UPDATED' | 'URL_DELETED'>('URL_UPDATED')

const recentSubmitted = ref<{ url: string; at: Date }[]>([])

const breadcrumbItems = [{ label: 'Dashboard', to: '/' }, { label: 'Indexing' }]

async function onSubmitIndexing() {
  if (!indexingUrl.value.trim()) return
  await submitUrl(indexingUrl.value.trim(), indexingType.value)
  if (!indexingPublishError.value) {
    recentSubmitted.value = [{ url: indexingUrl.value, at: new Date() }, ...recentSubmitted.value].slice(0, 10)
    toast.add({ title: 'URL submitted', description: indexingUrl.value, color: 'success' })
  } else {
    toast.add({ title: 'Submit failed', description: indexingPublishError.value?.message, color: 'error' })
  }
}

async function onCheckIndexingStatus() {
  if (!indexingStatusUrl.value.trim()) return
  await checkStatus(indexingStatusUrl.value.trim())
  if (!indexingStatusError.value) {
    toast.add({ title: 'Status loaded', color: 'success' })
  } else {
    toast.add({ title: 'Status check failed', description: indexingStatusError.value?.message, color: 'error' })
  }
}

const indexingResultJson = computed(() => {
  const raw = indexingPublishError.value ? { error: indexingPublishError.value?.message } : indexingPublishData.value
  return raw ? JSON.stringify(raw, null, 2) : ''
})
const indexingStatusJson = computed(() => {
  const raw = indexingStatusError.value ? { error: indexingStatusError.value?.message } : indexingStatusData.value
  return raw ? JSON.stringify(raw, null, 2) : ''
})
</script>

<template>
  <div>
    <AppBreadcrumbs :items="breadcrumbItems" />
    <h1 class="font-display text-2xl font-semibold text-default">
      Indexing
    </h1>
    <p class="mt-1 mb-6 text-sm text-muted">
      Submit URLs to Google Indexing API and check status
    </p>

    <div class="grid gap-8 lg:grid-cols-2">
      <UCard>
        <template #header>
          <h2 class="font-semibold text-default">Submit URL</h2>
        </template>
        <div class="form-section">
          <UFormField label="URL">
            <UInput
              v-model="indexingUrl"
              placeholder="https://example.com/page"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Type">
            <USelect
              v-model="indexingType"
              :items="[
                { value: 'URL_UPDATED', label: 'URL updated' },
                { value: 'URL_DELETED', label: 'URL deleted' },
              ]"
              value-attribute="value"
              class="w-full"
            />
          </UFormField>
          <UButton
            :loading="loadingIndexing"
            class="cursor-pointer"
            @click="onSubmitIndexing"
          >
            Submit
          </UButton>
          <div v-if="indexingResultJson" class="rounded-lg bg-muted p-3 text-sm">
            <pre class="whitespace-pre-wrap">{{ indexingResultJson }}</pre>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold text-default">Check status</h2>
        </template>
        <div class="form-section">
          <UFormField label="URL">
            <UInput
              v-model="indexingStatusUrl"
              placeholder="https://example.com/page"
              class="w-full"
            />
          </UFormField>
          <UButton
            :loading="loadingStatus"
            variant="outline"
            class="cursor-pointer"
            @click="onCheckIndexingStatus"
          >
            Check status
          </UButton>
          <div v-if="indexingStatusJson" class="rounded-lg bg-muted p-3 text-sm">
            <pre class="whitespace-pre-wrap">{{ indexingStatusJson }}</pre>
          </div>
        </div>
      </UCard>
    </div>

    <UCard v-if="recentSubmitted.length" class="mt-6">
      <template #header>
        <h2 class="font-semibold text-default">Recently submitted</h2>
      </template>
      <ul class="space-y-2 text-sm">
        <li
          v-for="(item, i) in recentSubmitted"
          :key="i"
          class="flex items-center justify-between gap-2 rounded border border-default px-3 py-2"
        >
          <span class="min-w-0 truncate text-default">{{ item.url }}</span>
          <NuxtTime :datetime="item.at" relative class="shrink-0 text-muted" />
        </li>
      </ul>
    </UCard>
  </div>
</template>
