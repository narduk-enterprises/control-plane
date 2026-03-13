<script setup lang="ts">
import type { ChartData } from 'chart.js'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import annotationPlugin from 'chartjs-plugin-annotation'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin,
)

const props = withDefaults(
  defineProps<{
    /** Main series: date -> value */
    data: { date: string; value: number }[]
    /** Optional previous period (ghost line) */
    compareData?: { date: string; value: number }[]
    /** Chart title */
    title?: string
    /** Vertical line annotations at dates */
    annotations?: { date: string; label: string }[]
  }>(),
  { title: '', compareData: undefined, annotations: () => [] },
)

const chartData = computed(() => {
  const labels = props.data.map((d) => d.date)
  const mainDataset = {
    label: props.title || 'Value',
    data: props.data.map((d) => d.value),
    borderColor: 'var(--ui-primary)',
    backgroundColor: 'var(--ui-primary)',
    fill: true,
    tension: 0.2,
    pointRadius: 0,
    pointHoverRadius: 4,
  }
  const datasets: ChartData<'line'>['datasets'] = [mainDataset]
  if (props.compareData?.length) {
    const compareLabels = props.compareData.map((d) => d.date)
    const compareValues = props.compareData.map((d) => d.value)
    const aligned = labels.map((label) => {
      const i = compareLabels.indexOf(label)
      return i >= 0 ? (compareValues[i] ?? 0) : 0
    })
    datasets.push({
      label: 'Previous period',
      data: aligned,
      borderColor: 'var(--ui-neutral-400)',
      backgroundColor: 'transparent',
      borderDash: [4, 4],
      borderWidth: 1,
      fill: false,
      tension: 0.2,
      pointRadius: 0,
      pointHoverRadius: 4,
    })
  }
  return { labels, datasets }
})

const annotationPluginsConfig = computed(() => {
  const ann = props.annotations
  if (!ann?.length) return {}
  const vLines: Record<
    string,
    {
      type: 'line'
      xMin: string
      xMax: string
      borderColor: string
      borderWidth: number
      borderDash: number[]
    }
  > = {}
  for (const [i, a] of ann.entries()) {
    vLines[`vline-${i}`] = {
      type: 'line',
      xMin: a.date,
      xMax: a.date,
      borderColor: 'var(--ui-neutral-400)',
      borderWidth: 1,
      borderDash: [2, 2],
    }
  }
  return { annotation: { annotations: vLines } }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    title: props.title
      ? { display: true, text: props.title, font: { size: 12 } }
      : { display: false },
    legend: { display: !!props.compareData?.length },
    tooltip: {
      callbacks: {
        label(ctx: { dataset: { label?: string }; raw: unknown }) {
          const label = ctx.dataset?.label ?? ''
          const value = typeof ctx.raw === 'number' ? ctx.raw.toLocaleString() : ctx.raw
          return `${label}: ${value}`
        },
      },
    },
    ...annotationPluginsConfig.value,
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { maxTicksLimit: 8, maxRotation: 0 },
    },
    y: {
      beginAtZero: true,
      grid: { color: 'var(--ui-neutral-200)' },
      ticks: { maxTicksLimit: 6 },
    },
  },
}))
</script>

<template>
  <ClientOnly>
    <div class="h-64 w-full">
      <Line v-if="chartData.labels.length" :data="chartData" :options="chartOptions" />
      <div v-else class="flex h-full items-center justify-center text-sm text-muted">No data</div>
    </div>
    <template #fallback>
      <div class="h-64 w-full animate-pulse rounded-lg bg-elevated/50" />
    </template>
  </ClientOnly>
</template>
