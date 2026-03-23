<script setup lang="ts">
defineProps<{
  items: Array<{
    value: string
    label: string
    icon: string
    description?: string
  }>
}>()

const active = defineModel<string>({ required: true })
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-2">
      <UButton
        v-for="item in items"
        :key="item.value"
        size="sm"
        :color="active === item.value ? 'primary' : 'neutral'"
        :variant="active === item.value ? 'solid' : 'ghost'"
        :icon="item.icon"
        class="cursor-pointer rounded-full"
        @click="active = item.value"
      >
        {{ item.label }}
      </UButton>
    </div>
    <p
      v-for="item in items"
      v-show="item.value === active && item.description"
      :key="`${item.value}-description`"
      class="text-sm text-muted"
    >
      {{ item.description }}
    </p>
  </div>
</template>
