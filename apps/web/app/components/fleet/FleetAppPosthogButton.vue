<script setup lang="ts">
const props = defineProps<{ appName: string }>()
const today = new Date().toISOString().split('T')[0]!
const { data, error, loading, load } = useFleetPosthog(() => props.appName, today, today)
const open = ref(false)

async function onOpen() {
  open.value = true
  await load()
}

const jsonResult = computed(() => (data.value ? JSON.stringify(data.value.summary, null, 2) : ''))
</script>

<template>
  <div>
    <UButton size="xs" variant="outline" color="neutral" :loading="loading" @click="onOpen">
      PostHog
    </UButton>
    <UModal v-model:open="open">
      <template #header> PostHog — {{ appName }} </template>
      <template #body>
        <div v-if="loading" class="py-4 text-muted">Loading…</div>
        <div v-else-if="error" class="py-4 text-error">{{ error?.message }}</div>
        <div v-else-if="data" class="space-y-2">
          <p class="text-sm text-muted">{{ data.startDate }} → {{ data.endDate }}</p>
          <pre class="max-h-80 overflow-auto rounded bg-muted p-2 text-xs">{{ jsonResult }}</pre>
        </div>
      </template>
    </UModal>
  </div>
</template>
