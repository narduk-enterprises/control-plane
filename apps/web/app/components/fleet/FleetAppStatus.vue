<script setup lang="ts">
const props = defineProps<{
  url: string
}>()

const { data, status, error } = useFleetAppStatus(() => props.url)

type BadgeColor = 'neutral' | 'error' | 'success'

const badgeConfig = computed(() => {
  if (!props.url || props.url === 'undefined') {
    return { color: 'neutral' as BadgeColor, icon: 'i-lucide-slash', label: 'N/A', class: '' }
  }
  if (status.value === 'pending' || status.value === 'idle') {
    return { color: 'neutral' as BadgeColor, icon: 'i-lucide-loader-2', label: 'Checking...', class: 'animate-pulse' }
  }
  if (error.value || data.value?.status === 'down') {
    return { color: 'error' as BadgeColor, icon: 'i-lucide-x-circle', label: 'Down', class: '' }
  }
  return { color: 'success' as BadgeColor, icon: 'i-lucide-check-circle-2', label: 'Up', class: '' }
})
</script>

<template>
  <UBadge
    :color="badgeConfig.color"
    variant="subtle"
    size="sm"
    :class="badgeConfig.class"
  >
    <UIcon :name="badgeConfig.icon" class="mr-1 size-3.5" :class="{ 'animate-spin': badgeConfig.icon === 'i-lucide-loader-2' }" />
    {{ badgeConfig.label }}
  </UBadge>
</template>
