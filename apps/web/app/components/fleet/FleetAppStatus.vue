<script setup lang="ts">
import type { FleetAppStatusRecord } from '~/types/fleet'

const props = defineProps<{
  appStatus?: FleetAppStatusRecord
}>()

type BadgeColor = 'neutral' | 'error' | 'success'

const badgeConfig = computed(() => {
  if (!props.appStatus) {
    return { color: 'neutral' as BadgeColor, icon: 'i-lucide-help-circle', label: 'Unknown', class: 'opacity-75' }
  }
  if (props.appStatus.status === 'down') {
    return { color: 'error' as BadgeColor, icon: 'i-lucide-x-circle', label: 'Down', class: 'ring-1 ring-error/50 font-medium' }
  }
  return { color: 'success' as BadgeColor, icon: 'i-lucide-check-circle-2', label: 'Up', class: '' }
})

const checkedAgo = computed(() => {
  if (!props.appStatus?.checkedAt) return ''
  const diff = Date.now() - new Date(props.appStatus.checkedAt).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  return `${hours}h ago`
})

const { refreshAppStatus, isAppRefreshing } = useFleetStatuses()
const isRefreshing = computed(() => props.appStatus?.app ? isAppRefreshing(props.appStatus.app) : false)

async function handleRefresh() {
  if (!props.appStatus?.app) return
  await refreshAppStatus(props.appStatus.app)
}

const isMounted = ref(false)
onMounted(() => {
  isMounted.value = true
})
</script>

<template>
  <div class="flex items-center gap-1.5">
    <UTooltip :text="checkedAgo || 'Not checked yet'">
      <UBadge
        :color="badgeConfig.color"
        variant="subtle"
        size="sm"
        :class="badgeConfig.class"
      >
        <UIcon :name="badgeConfig.icon" class="mr-1 size-3.5" />
        {{ badgeConfig.label }}
      </UBadge>
    </UTooltip>
    
    <UButton
      v-if="props.appStatus?.app"
      variant="ghost"
      color="neutral"
      size="xs"
      :icon="(isMounted && isRefreshing) ? 'i-lucide-loader-2' : 'i-lucide-refresh-cw'"
      :class="[
        'size-6 p-0 transition-all cursor-pointer hover:bg-elevated text-muted hover:text-default rounded-full flex items-center justify-center shrink-0',
        (isMounted && isRefreshing) && 'animate-spin text-primary hover:text-primary relative scale-110'
      ]"
      :aria-label="`Refresh ${props.appStatus.app} status`"
      :disabled="isRefreshing"
      @click="handleRefresh"
    />
  </div>
</template>
