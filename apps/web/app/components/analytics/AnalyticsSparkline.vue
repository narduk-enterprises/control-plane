<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    data: { date: string; value: number }[]
    /** Optional previous period for ghost line */
    compareData?: { date: string; value: number }[]
    width?: number
    height?: number
    color?: string
  }>(),
  { width: 80, height: 28, color: 'var(--ui-primary)' },
)

const pathData = computed(() => {
  const d = props.data
  if (!d.length) return ''
  const w = props.width - 2
  const h = props.height - 2
  const max = Math.max(...d.map((x) => x.value), 1)
  const points = d.map((v, i) => {
    const x = 1 + (i / Math.max(d.length - 1, 1)) * w
    const y = 1 + h - (v.value / max) * h
    return `${x},${y}`
  })
  return `M ${points.join(' L ')}`
})

const comparePathData = computed(() => {
  const d = props.compareData
  if (!d?.length) return ''
  const w = props.width - 2
  const h = props.height - 2
  const max = Math.max(...d.map((x) => x.value), 1)
  const points = d.map((v, i) => {
    const x = 1 + (i / Math.max(d.length - 1, 1)) * w
    const y = 1 + h - (v.value / max) * h
    return `${x},${y}`
  })
  return `M ${points.join(' L ')}`
})
</script>

<template>
  <div class="inline-block overflow-hidden rounded" :style="{ width: `${width}px`, height: `${height}px` }">
    <svg :width="width" :height="height" class="block" xmlns="http://www.w3.org/2000/svg">
      <path
        v-if="comparePathData"
        :d="comparePathData"
        fill="none"
        stroke="var(--ui-neutral-300)"
        stroke-width="1"
        stroke-dasharray="2 2"
        opacity="0.6"
      />
      <path
        v-if="pathData"
        :d="pathData"
        fill="none"
        :stroke="color"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>
</template>
