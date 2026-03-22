<script setup lang="ts">
const props = defineProps<{
  provider: string
  error: Error | string | null
}>()

defineEmits<{
  retry: []
}>()
const description = computed(() => {
  if (!props.error) return 'An unknown error occurred.'
  return typeof props.error === 'string'
    ? props.error
    : props.error.message || 'An unknown error occurred. The server may be warming its cache.'
})
</script>

<template>
  <UAlert
    v-if="props.error"
    icon="i-lucide-alert-circle"
    :title="`${props.provider} error`"
    color="error"
    variant="subtle"
    :description="description"
  >
    <template #actions>
      <UButton
        size="xs"
        color="error"
        variant="soft"
        class="cursor-pointer"
        @click="$emit('retry')"
      >
        Retry
      </UButton>
    </template>
  </UAlert>
</template>
