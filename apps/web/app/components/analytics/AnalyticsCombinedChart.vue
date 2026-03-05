<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  gaData?: { date: string; value: number }[];
  gscData?: { date: string; value: number }[];
  posthogData?: { date: string; value: number }[];
  title?: string;
}>();

// Container and dimensions (arbitrary grid internal coordinates)
const chartWidth = 800;
const chartHeight = 240;
const padY = 20;
const padX = 20;

const viewBox = computed(() => `0 0 ${chartWidth} ${chartHeight}`);

// Define colors per dataset
const colors = {
  ga: 'var(--ui-primary)', // Deep blue
  gsc: 'var(--ui-info)', // Lighter blue
  posthog: 'var(--ui-warning)', // Amber
};

// Ensure all dates are represented, sorted
const allDates = computed(() => {
  const dates = new Set<string>();
  if (props.gaData) for (const d of props.gaData) dates.add(d.date);
  if (props.gscData) for (const d of props.gscData) dates.add(d.date);
  if (props.posthogData) for (const d of props.posthogData) dates.add(d.date);
  return Array.from(dates).sort();
});

function createLine(data: { date: string; value: number }[] | undefined, color: string) {
  if (!data || data.length === 0 || allDates.value.length === 0) return null;

  // Normalize values
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const usableWidth = chartWidth - padX * 2;
  const usableHeight = chartHeight - padY * 2;
  const gap = usableWidth / Math.max(allDates.value.length - 1, 1);

  // Map dates to points
  const points = allDates.value.map((date, i) => {
    const x = padX + i * gap;
    // Find value for this date
    const d = data.find((item) => item.date === date);
    const val = d ? d.value : 0;
    const y = chartHeight - padY - (val / maxVal) * usableHeight;
    return { x, y, value: val, date };
  });

  // Create SVG path
  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return { points, pathData, color };
}

const gaLine = computed(() => createLine(props.gaData, colors.ga));
const gscLine = computed(() => createLine(props.gscData, colors.gsc));
const posthogLine = computed(() => createLine(props.posthogData, colors.posthog));

const hasData = computed(() => !!gaLine.value || !!gscLine.value || !!posthogLine.value);

// Format date for tooltip
function formatDate(dateStr: string) {
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
      new Date(dateStr)
    );
  } catch (_e) {
    return dateStr;
  }
}
</script>

<template>
  <div class="relative w-full overflow-hidden rounded-xl border border-default bg-elevated/30">
    <div class="px-5 pt-4 pb-2 flex items-center justify-between">
      <h4 class="text-sm font-medium text-muted">{{ title || 'Combined Analytics Trend' }}</h4>
      <div class="flex items-center gap-4 text-xs font-medium">
        <div class="flex items-center gap-1.5" v-if="gaData?.length">
          <div class="size-2 rounded-full" :style="{ backgroundColor: colors.ga }"></div>
          <span class="text-muted">GA4 (Pageviews)</span>
        </div>
        <div class="flex items-center gap-1.5" v-if="gscData?.length">
          <div class="size-2 rounded-full" :style="{ backgroundColor: colors.gsc }"></div>
          <span class="text-muted">GSC (Clicks)</span>
        </div>
        <div class="flex items-center gap-1.5" v-if="posthogData?.length">
          <div class="size-2 rounded-full" :style="{ backgroundColor: colors.posthog }"></div>
          <span class="text-muted">PostHog (Events)</span>
        </div>
      </div>
    </div>

    <div class="px-5 pb-5">
      <template v-if="hasData">
        <!-- eslint-disable-next-line atx/no-inline-svg -->
        <svg
          class="w-full h-56 overflow-visible"
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

          <!-- GA Path -->
          <path
            v-if="gaLine"
            :d="gaLine.pathData"
            fill="none"
            :stroke="gaLine.color"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="transition-all duration-500"
          />
          <!-- GSC Path -->
          <path
            v-if="gscLine"
            :d="gscLine.pathData"
            fill="none"
            :stroke="gscLine.color"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="transition-all duration-500"
          />
          <!-- Posthog Path -->
          <path
            v-if="posthogLine"
            :d="posthogLine.pathData"
            fill="none"
            :stroke="posthogLine.color"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="transition-all duration-500"
          />

          <!-- Interactive Points for Tooltips (GA) -->
          <g v-if="gaLine">
            <circle
              v-for="(point, i) in gaLine.points"
              :key="'ga-' + i"
              :cx="point.x"
              :cy="point.y"
              r="4"
              :fill="gaLine.color"
              class="cursor-crosshair hover:r-6 transition-all"
            >
              <title>
                {{ formatDate(point.date) }}: {{ point.value.toLocaleString() }} GA Pageviews
              </title>
            </circle>
          </g>

          <!-- Interactive Points for Tooltips (GSC) -->
          <g v-if="gscLine">
            <circle
              v-for="(point, i) in gscLine.points"
              :key="'gsc-' + i"
              :cx="point.x"
              :cy="point.y"
              r="4"
              :fill="gscLine.color"
              class="cursor-crosshair hover:r-6 transition-all"
            >
              <title>
                {{ formatDate(point.date) }}: {{ point.value.toLocaleString() }} GSC Clicks
              </title>
            </circle>
          </g>

          <!-- Interactive Points for Tooltips (PostHog) -->
          <g v-if="posthogLine">
            <circle
              v-for="(point, i) in posthogLine.points"
              :key="'ph-' + i"
              :cx="point.x"
              :cy="point.y"
              r="4"
              :fill="posthogLine.color"
              class="cursor-crosshair hover:r-6 transition-all"
            >
              <title>
                {{ formatDate(point.date) }}: {{ point.value.toLocaleString() }} PostHog Events
              </title>
            </circle>
          </g>
        </svg>
      </template>
      <div v-else class="flex h-56 items-center justify-center text-sm text-disabled">
        No combined trend data available
      </div>
    </div>
  </div>
</template>

<style scoped>
.stroke-dashed {
  stroke-dasharray: 4 4;
}
</style>
