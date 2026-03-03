<script setup lang="ts">
import { watch } from 'vue'

const props = defineProps<{ appName: string; active?: boolean }>()

const { data, error, loading, load } = useFleetPosthog(() => props.appName)

watch(() => props.active, (isActive) => {
  if (isActive && !data.value && !loading.value && !error.value) {
    load()
  }
}, { immediate: true })

const summary = computed(() => {
  const d = data.value as { summary: Record<string, unknown> } | null
  if (!d || typeof d.summary !== 'object') return null
  const s = d.summary
  return {
    eventCount: Number(s.event_count ?? 0),
    users: Number(s.unique_users ?? 0),
    pageviews: Number(s.pageviews ?? 0),
    sessions: Number(s.sessions ?? 0),
  }
})

const dateRange = computed(() => {
  const d = data.value as { startDate?: string; endDate?: string } | null
  if (!d?.startDate || !d?.endDate) return null
  return `${d.startDate} → ${d.endDate}`
})

async function onLoad() {
  await load()
}

// Columns for the mini-tables
const miniColumns = [
  { accessorKey: 'name', header: 'Item' },
  { accessorKey: 'count', header: 'Count', class: 'w-20 text-right' }
]
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex gap-2">
        <UButton
          :loading="loading"
          class="cursor-pointer"
          @click="onLoad"
        >
          Load PostHog (last 30 days)
        </UButton>
        <UButton
          v-if="data?.replaysUrl"
          :to="data.replaysUrl"
          target="_blank"
          variant="outline"
          color="neutral"
          icon="i-lucide-video"
          class="cursor-pointer"
        >
          View Session Replays
        </UButton>
      </div>
    </div>

    <FleetSharedAnalyticsCard
      provider-name="PostHog"
      icon-name="i-lucide-users"
      :loading="loading"
      :error="error || null"
      :summary="summary"
      :time-series="data?.timeSeries"
      :date-range="dateRange"
      hide-button
      @load="onLoad"
    />

    <div v-if="data && !loading" class="grid gap-4 md:grid-cols-2">
      <!-- Top Pages -->
      <UCard v-if="data.topPages?.length" class="overflow-hidden">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-file-text" class="text-primary-500" />
            <h3 class="text-sm font-medium">Top Pages</h3>
          </div>
        </template>
        <UTable :data="data.topPages" :columns="miniColumns" class="text-xs" />
      </UCard>

      <!-- Top Referrers -->
      <UCard v-if="data.topReferrers?.length" class="overflow-hidden">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-external-link" class="text-primary-500" />
            <h3 class="text-sm font-medium">Top Referrers</h3>
          </div>
        </template>
        <UTable :data="data.topReferrers" :columns="miniColumns" class="text-xs" />
      </UCard>

      <!-- Top Countries -->
      <UCard v-if="data.topCountries?.length" class="overflow-hidden">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-globe" class="text-primary-500" />
            <h3 class="text-sm font-medium">Top Countries</h3>
          </div>
        </template>
        <UTable :data="data.topCountries" :columns="miniColumns" class="text-xs" />
      </UCard>

      <!-- Top Browsers -->
      <UCard v-if="data.topBrowsers?.length" class="overflow-hidden">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-laptop" class="text-primary-500" />
            <h3 class="text-sm font-medium">Top Browsers</h3>
          </div>
        </template>
        <UTable :data="data.topBrowsers" :columns="miniColumns" class="text-xs" />
      </UCard>
    </div>
  </div>
</template>
