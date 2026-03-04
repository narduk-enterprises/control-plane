<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: { date: string; value: number }[]
  title?: string
}>()

// Container and dimensions (arbitrary grid internal coordinates)
const chartWidth = 600
const chartHeight = 120
const padY = 10
const padX = 10

const viewBox = computed(() => `0 0 ${chartWidth} ${chartHeight}`)

const maxValue = computed(() => {
  if (!props.data || props.data.length === 0) return 0
  return Math.max(...props.data.map((d) => d.value))
})

const items = computed(() => {
  if (!props.data || props.data.length === 0) return []
  const max = Math.max(maxValue.value, 1) // Prevent division by 0
  const usableWidth = chartWidth - padX * 2
  const usableHeight = chartHeight - padY * 2
  const barWidth = Math.max(usableWidth / props.data.length - 2, 2)
  const gap = usableWidth / props.data.length

  return props.data.map((d, i) => {
    const height = (d.value / max) * usableHeight
    const x = padX + i * gap
    const y = chartHeight - padY - height
    
    // Add tooltip text formatting
    const formattedDate = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(d.date))

    return {
      x,
      y,
      width: barWidth,
      height: Math.max((d.value / max) * usableHeight, 1),
      value: d.value,
      date: formattedDate,
      fullDate: d.date,
      tooltipText: `${formattedDate}: ${d.value.toLocaleString()} pageviews`
    }
  })
})
</script>

<template>
  <div class="relative w-full overflow-hidden rounded-xl border border-default bg-elevated/30">
    <div class="px-5 pt-4 pb-2">
      <h4 class="text-sm font-medium text-muted">{{ title || 'Trend' }}</h4>
    </div>
    
    <div class="px-5 pb-5">
      <template v-if="items.length > 0">
        <!-- eslint-disable-next-line atx/no-inline-svg -->
        <svg
          class="w-full h-32 overflow-visible"
          :viewBox="viewBox"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <!-- Grid lines -->
          <line
            :x1="padX"
            :y1="chartHeight - padY"
            :x2="chartWidth - padX"
            :y2="chartHeight - padY"
            class="stroke-default opacity-50"
            stroke-width="1"
          />
          <line
            :x1="padX"
            :y1="padY + (chartHeight - padY * 2) / 2"
            :x2="chartWidth - padX"
            :y2="padY + (chartHeight - padY * 2) / 2"
            class="stroke-default opacity-20 stroke-dashed"
            stroke-width="1"
            stroke-dasharray="4 4"
          />

          <!-- Bars -->
          <g v-for="(item, index) in items" :key="index" class="group relative cursor-crosshair">
            <!-- Background hover target (invisible but catches pointer) -->
            <rect
              :x="item.x - 1"
              :y="padY"
              :width="item.width + 2"
              :height="chartHeight - padY * 2"
              fill="transparent"
            />
            
            <rect
              :x="item.x"
              :y="item.y"
              :width="item.width"
              :height="item.height"
              rx="2"
              class="fill-primary-500/80 transition-all duration-300 group-hover:fill-primary-400 group-hover:-translate-y-1"
            />
            
            <!-- SVG Tooltip structure - very minimal, usually HTML is better but we use UI component if available -->
            <title>{{ item.tooltipText }}</title>
          </g>
        </svg>
      </template>
      <div v-else class="flex h-32 items-center justify-center text-sm text-disabled">
        No trend data available
      </div>
    </div>
  </div>
</template>

<style scoped>
.stroke-dashed {
  stroke-dasharray: 4 4;
}
</style>
