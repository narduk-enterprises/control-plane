<script setup lang="ts">
const props = defineProps<{
  appName?: string
  stats: { eventCount: number; users: number } | null | undefined
  loading?: boolean
  loaded?: boolean
}>()

const { refreshPosthog, isRefreshingStatus: refreshing } = useFleet()
const manualStats = ref<{ eventCount: number; users: number } | null>(null)

const displayStats = computed(() => manualStats.value || props.stats)

async function handleRefresh() {
  if (!props.appName || refreshing.value) return

  try {
    await refreshPosthog()
  } catch (err) {
    console.error(`[PostHog Refresh] Error for ${props.appName}:`, err)
  }
}

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'm'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return num.toString()
}
const isMounted = ref(false)
onMounted(() => {
  isMounted.value = true
})
</script>

<template>
  <div class="group flex items-center gap-3 text-sm min-w-[120px]">
    <template v-if="isMounted && (loading || refreshing)">
      <UIcon name="i-lucide-loader-2" class="size-4 animate-spin text-muted" />
    </template>

    <template v-else-if="!props.loaded && !manualStats">
      <span class="text-xs text-muted">—</span>
    </template>

    <template v-else-if="displayStats">
      <div class="flex items-center gap-1.5" title="Unique Users">
        <UIcon name="i-lucide-users" class="size-3.5 text-primary/70" />
        <span class="font-medium text-default">{{ formatNumber(displayStats.users) }}</span>
      </div>
      <div class="flex items-center gap-1.5" title="Events">
        <UIcon name="i-lucide-activity" class="size-3.5 text-primary/70" />
        <span class="font-medium text-default">{{ formatNumber(displayStats.eventCount) }}</span>
      </div>

      <!-- Individual refresh button -->
      <UButton
        v-if="props.appName"
        variant="ghost"
        color="neutral"
        size="xs"
        icon="i-lucide-refresh-cw"
        class="invisible group-hover:visible size-6 p-0 cursor-pointer opacity-50 hover:opacity-100"
        title="Refresh this app"
        :loading="refreshing"
        @click.stop="handleRefresh"
      />
    </template>

    <template v-else>
      <span class="text-xs text-muted">No data</span>
    </template>
  </div>
</template>
