<script setup lang="ts">
const props = defineProps<{ appName: string; active?: boolean }>()

const { preset, startDate, endDate, presetOptions, presetLabel, setPreset } =
  useAnalyticsDateRange('today')
const force = ref(false)
const { data, error, loading, load } = useFleetPosthog(
  () => props.appName,
  startDate,
  endDate,
  force,
)

async function onForceRefresh() {
  force.value = true
  await load()
  force.value = false
}

// Data is loaded natively by Nuxt useFetch reactivity on the URL hook

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

function onPresetChange(p: string) {
  setPreset(p as Parameters<typeof setPreset>[0])
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex gap-2">
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
      :preset-options="presetOptions"
      :active-preset="preset"
      :preset-label="presetLabel"
      v-model:start-date="startDate"
      v-model:end-date="endDate"
      hide-button
      @load="load"
      @preset="onPresetChange"
      @refresh="onForceRefresh"
    />

    <div v-if="data && !loading" class="grid gap-4 md:grid-cols-2">
      <FleetTopDimensionCard
        title="Top Pages"
        icon="i-lucide-file-text"
        :items="data.topPages ?? []"
      />
      <FleetTopDimensionCard
        title="Top Referrers"
        icon="i-lucide-external-link"
        :items="data.topReferrers ?? []"
      />
      <FleetTopDimensionCard
        title="Top Countries"
        icon="i-lucide-globe"
        :items="data.topCountries ?? []"
      />
      <FleetTopDimensionCard
        title="Top Browsers"
        icon="i-lucide-laptop"
        :items="data.topBrowsers ?? []"
      />
    </div>
  </div>
</template>
