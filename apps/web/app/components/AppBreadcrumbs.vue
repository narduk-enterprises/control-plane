<script setup lang="ts">
defineProps<{
  items: { label: string; to?: string }[]
}>()
</script>

<template>
  <div role="navigation" aria-label="Breadcrumb" class="flex items-center gap-2 text-sm text-muted mb-6">
    <template v-for="(item, i) in items" :key="i">
      <span v-if="i > 0" class="text-muted/70" aria-hidden="true">/</span>
      <NuxtLink
        v-if="item.to"
        :to="item.to"
        class="hover:text-default transition-colors cursor-pointer"
      >
        {{ item.label }}
      </NuxtLink>
      <span v-else class="text-default font-medium">{{ item.label }}</span>
    </template>
  </div>
</template>
