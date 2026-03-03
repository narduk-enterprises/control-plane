<script setup lang="ts">
const props = defineProps<{ appName: string }>()
const { data, error, loading, submit } = useFleetIndexnow(() => props.appName)
const open = ref(false)

async function onSubmit() {
  open.value = true
  await submit()
}

const jsonResult = computed(() =>
  data.value ? JSON.stringify(data.value.response, null, 2) : '',
)
</script>

<template>
  <div>
    <UButton
      size="xs"
      variant="outline"
      color="neutral"
      :loading="loading"
      @click="onSubmit"
    >
      IndexNow
    </UButton>
    <UModal v-model:open="open">
      <UCard>
        <template #header>
          IndexNow — {{ appName }}
        </template>
        <div v-if="loading" class="py-4 text-muted">Submitting…</div>
        <div v-else-if="error" class="py-4 text-error">{{ error?.message }}</div>
        <div v-else-if="data" class="space-y-2">
          <p class="text-sm text-muted">
            Status {{ data.status }} — {{ data.targetUrl }}
          </p>
          <pre class="max-h-80 overflow-auto rounded bg-muted p-2 text-xs">{{ jsonResult }}</pre>
        </div>
      </UCard>
    </UModal>
  </div>
</template>
