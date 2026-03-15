<script setup lang="ts">
import type { GscInspection } from '~/composables/useFleetGscQuery'

const props = defineProps<{
  inspection: GscInspection
}>()

const inspectionRef = computed(() => props.inspection)
const { formattedLastCrawlTime, formattedCrawledAs, coverageState, inspectionLink, isPass } =
  useGscInspection(inspectionRef)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon
          :name="isPass ? 'i-lucide-check-circle' : 'i-lucide-alert-circle'"
          :class="isPass ? 'text-success' : 'text-warning'"
          class="size-5"
        />
        <h3 class="text-sm font-medium text-default">URL Inspection</h3>
      </div>
    </template>
    <p class="text-sm text-muted">
      {{ coverageState }}
    </p>
    <div class="mt-2 flex flex-wrap gap-4 text-xs text-muted">
      <span v-if="formattedLastCrawlTime">Last crawled: {{ formattedLastCrawlTime }}</span>
      <span v-if="formattedCrawledAs">Agent: {{ formattedCrawledAs }}</span>
    </div>
    <UButton
      v-if="inspectionLink"
      :to="inspectionLink"
      target="_blank"
      variant="outline"
      size="sm"
      class="mt-3 cursor-pointer"
      icon="i-lucide-external-link"
    >
      View in GSC
    </UButton>
  </UCard>
</template>
