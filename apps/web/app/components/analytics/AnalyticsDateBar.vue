<script setup lang="ts">
import type { DatePreset } from '~/composables/useAnalyticsDateRange'

defineProps<{
  presetOptions: { value: DatePreset; label: string }[]
  activePreset: DatePreset
  loading?: boolean
  showRefresh?: boolean
  freshness?: string | null
}>()

const startDate = defineModel<string>('startDate')
const endDate = defineModel<string>('endDate')

defineEmits<{
  preset: [value: DatePreset]
  refresh: []
}>()
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-thin">
      <div class="flex gap-1 shrink-0">
        <UButton
          v-for="opt in presetOptions"
          :key="opt.value"
          size="xs"
          :color="activePreset === opt.value ? 'primary' : 'neutral'"
          :variant="activePreset === opt.value ? 'solid' : 'outline'"
          class="cursor-pointer rounded-full whitespace-nowrap min-h-[32px] min-w-[44px]"
          @click="$emit('preset', opt.value)"
        >
          {{ opt.label }}
        </UButton>
      </div>
      <div class="flex-1" />
      <div v-if="showRefresh" class="flex items-center gap-2 shrink-0">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-refresh-cw"
          size="xs"
          class="cursor-pointer min-h-[32px]"
          :loading="loading"
          @click="$emit('refresh')"
        >
          Refresh
        </UButton>
        <span v-if="freshness" class="text-xs text-muted whitespace-nowrap">{{ freshness }}</span>
      </div>
    </div>

    <div
      v-if="activePreset === 'custom'"
      class="flex items-center gap-2 bg-elevated/50 p-2 rounded-lg w-fit border border-default"
    >
      <UInput v-model="startDate" type="date" size="sm" />
      <span class="text-xs text-muted">to</span>
      <UInput v-model="endDate" type="date" size="sm" />
    </div>
  </div>
</template>
