<script setup lang="ts">
import type { DatePreset } from '~/composables/useAnalyticsDateRange'

const props = defineProps<{
  presetOptions: { value: DatePreset; label: string }[]
  activePreset: DatePreset
  loading?: boolean
  showRefresh?: boolean
  freshness?: string | null
}>()

const startDate = defineModel<string>('startDate')
const endDate = defineModel<string>('endDate')

const emit = defineEmits<{
  preset: [value: DatePreset]
  refresh: []
}>()

// Dropdown model for mobile preset selector
const selectedPreset = computed({
  get: () => props.activePreset,
  set: (v: DatePreset) => emit('preset', v),
})
</script>

<template>
  <div class="flex flex-col gap-2 min-w-0">
    <div class="flex items-center gap-2 min-w-0">
      <!-- Mobile: dropdown selector (visible below md) -->
      <div class="md:hidden min-w-0 flex-1">
        <USelect
          v-model="selectedPreset"
          :items="presetOptions.map((o) => ({ label: o.label, value: o.value }))"
          size="sm"
          class="w-full"
        />
      </div>

      <!-- Desktop: pill buttons (hidden below md) -->
      <div class="hidden md:flex gap-1 overflow-x-auto scrollbar-none min-w-0">
        <UButton
          v-for="opt in presetOptions"
          :key="opt.value"
          size="xs"
          :color="activePreset === opt.value ? 'primary' : 'neutral'"
          :variant="activePreset === opt.value ? 'solid' : 'ghost'"
          class="cursor-pointer rounded-full whitespace-nowrap"
          @click="$emit('preset', opt.value)"
        >
          {{ opt.label }}
        </UButton>
      </div>

      <!-- Refresh button (always visible) -->
      <UButton
        v-if="showRefresh"
        color="neutral"
        variant="ghost"
        icon="i-lucide-refresh-cw"
        size="sm"
        aria-label="Refresh analytics"
        title="Refresh analytics"
        class="cursor-pointer shrink-0"
        :loading="loading"
        @click="$emit('refresh')"
      />
    </div>

    <!-- Custom date range picker -->
    <div
      v-if="activePreset === 'custom'"
      class="flex flex-wrap items-center gap-2 bg-elevated/50 p-2 rounded-lg border border-default"
    >
      <UInput v-model="startDate" type="date" size="sm" class="w-[140px]" />
      <span class="text-xs text-muted">to</span>
      <UInput v-model="endDate" type="date" size="sm" class="w-[140px]" />
    </div>

    <!-- Freshness indicator -->
    <span v-if="freshness" class="text-xs text-muted">
      {{ freshness }}
    </span>
  </div>
</template>
