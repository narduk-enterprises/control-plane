<script setup lang="ts">
import type { StatFormat } from '~/types/analytics'

const props = withDefaults(
  defineProps<{
    label: string
    value: number | undefined
    delta?: number
    format?: StatFormat
    invertDelta?: boolean
    icon?: string
    iconColor?: string
    loading?: boolean
    compact?: boolean
  }>(),
  {
    format: 'number',
    invertDelta: false,
    compact: false,
    delta: undefined,
    icon: undefined,
    iconColor: undefined,
  },
)

function formatValue(v: number | undefined, fmt: StatFormat): string {
  if (v === undefined || v === null) return '—'
  switch (fmt) {
    case 'percent':
      return `${(v * 100).toFixed(1)}%`
    case 'duration': {
      if (v >= 60) return `${Math.floor(v / 60)}m ${Math.floor(v % 60)}s`
      return `${Math.round(v)}s`
    }
    default:
      return v.toLocaleString()
  }
}

const displayValue = computed(() => formatValue(props.value, props.format ?? 'number'))

const deltaText = computed(() => {
  if (props.delta === undefined || Number.isNaN(props.delta)) return ''
  const sign = props.delta >= 0 ? '+' : ''
  return `${sign}${props.delta.toFixed(1)}%`
})

const deltaClass = computed(() => {
  if (props.delta === undefined) return 'text-muted'
  const positive = props.invertDelta ? props.delta <= 0 : props.delta >= 0
  return positive ? 'text-success' : 'text-error'
})
</script>

<template>
  <div
    class="rounded-xl border border-default bg-elevated/30"
    :class="compact ? 'p-3' : 'p-3 sm:p-4'"
  >
    <div v-if="icon" class="flex items-center gap-3">
      <div
        class="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-lg"
        :class="iconColor ?? 'bg-primary/10 text-primary'"
      >
        <UIcon :name="icon" class="size-4 sm:size-5" />
      </div>
      <div class="min-w-0">
        <p class="text-xs text-muted truncate">{{ label }}</p>
        <template v-if="loading && value === undefined">
          <div class="mt-1 h-6 w-14 rounded bg-default/10 animate-pulse" />
        </template>
        <template v-else>
          <p class="text-lg sm:text-xl font-semibold text-default leading-tight">
            {{ displayValue }}
          </p>
          <p v-if="deltaText" class="text-xs leading-tight" :class="deltaClass">
            {{ deltaText }} vs prev
          </p>
        </template>
      </div>
    </div>
    <template v-else>
      <p class="text-xs sm:text-sm font-medium text-muted">{{ label }}</p>
      <template v-if="loading && value === undefined">
        <div class="mt-1.5 h-7 w-16 rounded bg-default/10 animate-pulse" />
      </template>
      <template v-else>
        <p class="mt-1 text-lg sm:text-xl font-semibold text-default">{{ displayValue }}</p>
        <p v-if="deltaText" class="mt-0.5 text-xs" :class="deltaClass">{{ deltaText }} vs prev</p>
      </template>
    </template>
  </div>
</template>
