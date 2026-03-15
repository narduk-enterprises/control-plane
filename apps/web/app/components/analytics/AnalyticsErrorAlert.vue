<script setup lang="ts">
defineProps<{
  provider: string
  error: Error | null
}>()

defineEmits<{
  retry: []
}>()
</script>

<template>
  <UAlert
    v-if="error"
    icon="i-lucide-alert-circle"
    :title="`${provider} error`"
    color="error"
    variant="subtle"
    :description="
      error.message || 'An unknown error occurred. The server may be warming its cache.'
    "
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
