<script setup lang="ts">
const props = defineProps<{ appName: string }>()
const { data, error, loading, submit } = useFleetGscSitemap(() => props.appName)
const open = ref(false)

async function onSubmit() {
  open.value = true
  await submit(true)
}

const jsonResult = computed(() => (data.value ? JSON.stringify(data.value, null, 2) : ''))
</script>

<template>
  <div>
    <UButton size="xs" variant="outline" color="neutral" :loading="loading" @click="onSubmit">
      GSC sitemap
    </UButton>
    <UModal v-model:open="open">
      <template #header> GSC sitemap — {{ appName }} </template>
      <template #body>
        <div v-if="loading" class="py-4 text-muted">Submitting…</div>
        <div v-else-if="error" class="py-4 text-error">{{ error?.message }}</div>
        <div v-else-if="data" class="space-y-2">
          <p class="text-sm text-muted">
            {{
              data.action === 'unchanged'
                ? 'Up to date (same fingerprint).'
                : 'Submitted to Search Console.'
            }}
          </p>
          <pre class="max-h-80 overflow-auto rounded bg-muted p-2 text-xs">{{ jsonResult }}</pre>
        </div>
      </template>
    </UModal>
  </div>
</template>
