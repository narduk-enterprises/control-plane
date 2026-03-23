<script setup lang="ts">
/**
 * Reusable card for displaying top-N dimension data (pages, referrers, countries, browsers).
 * Extracted from PostHog and GSC panels to reduce duplication.
 */
const props = defineProps<{
  title: string
  icon: string
  items: { name: string; count: number }[]
}>()

const sortedItems = computed(() =>
  [...(props.items ?? [])].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
)

const columns = [
  { accessorKey: 'name', header: 'Item' },
  { accessorKey: 'count', header: 'Count', class: 'w-20 text-right' },
]
</script>

<template>
  <UCard v-if="items?.length" class="overflow-hidden">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon :name="icon" class="text-primary-500" />
        <h3 class="text-sm font-medium">{{ title }}</h3>
      </div>
    </template>
    <UTable :data="sortedItems" :columns="columns" class="text-xs" />
  </UCard>
</template>
