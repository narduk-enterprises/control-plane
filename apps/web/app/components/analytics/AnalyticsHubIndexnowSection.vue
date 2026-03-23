<script setup lang="ts">
defineProps<{
  indexnowSummary: {
    appsWithIndexnow?: number
    totalFleetSize?: number
    totalSubmissions?: number
  } | null
  indexnowSubmitting: boolean
}>()

const emit = defineEmits<{
  (e: 'batchSubmit'): void
}>()
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="indexnowSummary"
      class="flex flex-wrap items-center gap-3 rounded-xl border border-default/60 bg-elevated/30 px-4 py-3"
    >
      <div class="flex items-center gap-2 text-sm text-muted">
        <UIcon name="i-lucide-send" class="size-4 text-primary" />
        <span>IndexNow</span>
        <UBadge
          variant="subtle"
          size="sm"
          :color="(indexnowSummary.appsWithIndexnow ?? 0) > 0 ? 'success' : 'neutral'"
        >
          {{ indexnowSummary.appsWithIndexnow ?? 0 }}/{{ indexnowSummary.totalFleetSize ?? 0 }}
          apps
        </UBadge>
        <span class="hidden sm:inline">
          {{ indexnowSummary.totalSubmissions?.toLocaleString() ?? 0 }} total pings
        </span>
      </div>
      <UButton
        size="xs"
        variant="soft"
        color="primary"
        icon="i-lucide-send"
        class="ml-auto cursor-pointer"
        :loading="indexnowSubmitting"
        @click="emit('batchSubmit')"
      >
        Submit All
      </UButton>
    </div>
    <p v-else class="text-sm text-muted">Loading IndexNow summary…</p>
  </div>
</template>
