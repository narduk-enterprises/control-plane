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
  <div class="flex flex-col gap-2 min-w-0">
    <!-- Row 1: Preset buttons (scroll horizontally) + Refresh (always visible) -->
    <div class="flex items-center gap-2 min-w-0">
      <div class="flex gap-1 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5 min-w-0">
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
      <div v-if="showRefresh" class="flex items-center gap-2 shrink-0">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-refresh-cw"
          size="xs"
          class="cursor-pointer min-h-[32px] min-w-[44px]"
          :loading="loading"
          @click="$emit('refresh')"
        />
        <span v-if="freshness" class="text-xs text-muted whitespace-nowrap hidden sm:inline">
          {{ freshness }}
        </span>
      </div>
    </div>

    <!-- Row 2: Custom date range inputs (only when custom preset active) -->
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
