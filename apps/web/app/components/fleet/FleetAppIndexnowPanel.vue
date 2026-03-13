<script setup lang="ts">
const props = defineProps<{ appName: string; active?: boolean }>()

const { data, error, loading, submit } = useFleetIndexnow(() => props.appName)

const responseJson = computed(() => {
  const res = data.value?.response
  if (res == null || typeof res !== 'object') return ''
  return JSON.stringify(res, null, 2)
})

const showResponsePre = computed(
  () => data.value?.response != null && typeof data.value.response === 'object',
)

async function onSubmit() {
  await submit()
}

const formattedLastSubmission = computed(() => {
  if (!data.value?.indexnowLastSubmission) return null
  return new Date(data.value.indexnowLastSubmission).toLocaleString()
})
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-muted">
      Submit a ping to IndexNow for this app (optional URL list can be added later).
    </p>
    <UButton :loading="loading" class="cursor-pointer" @click="onSubmit"> Submit IndexNow </UButton>

    <div v-if="error" class="rounded-lg border border-error/30 bg-error/5 p-4">
      <p class="text-sm font-medium text-error">IndexNow error</p>
      <p class="mt-1 text-sm text-muted">{{ error?.message }}</p>
    </div>

    <div v-else-if="data" class="rounded-lg border border-default bg-elevated/30 p-4">
      <div class="flex justify-between items-start">
        <div>
          <p class="text-sm font-medium text-default">Status {{ data.status }}</p>
          <p class="mt-1 text-xs text-muted">{{ data.targetUrl }}</p>
        </div>
        <div v-if="formattedLastSubmission" class="text-right">
          <p class="text-xs font-medium text-primary">Last Submitted</p>
          <p class="text-[10px] text-muted">{{ formattedLastSubmission }}</p>
          <p v-if="data.indexnowLastSubmittedCount" class="text-[10px] text-muted">
            ({{ data.indexnowLastSubmittedCount }} URLs)
          </p>
        </div>
      </div>
      <p v-if="data.status === 404 && (data as any).message" class="mt-2 text-sm text-warning">
        {{ (data as any).message }}
      </p>
      <pre v-if="showResponsePre" class="mt-2 overflow-auto rounded bg-default p-2 text-xs">{{
        responseJson
      }}</pre>
    </div>
  </div>
</template>
