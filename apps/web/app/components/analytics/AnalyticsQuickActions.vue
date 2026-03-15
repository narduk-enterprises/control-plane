<script setup lang="ts">
const props = defineProps<{
  appName: string
  replaysUrl?: string
  inspectionLink?: string
}>()

const { loading: indexnowLoading, submit: submitIndexnow } = useFleetIndexnow(() => props.appName)
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-sm font-medium text-default">Quick Actions</h3>
    </template>
    <div class="flex flex-wrap gap-2">
      <UButton
        v-if="replaysUrl"
        :to="replaysUrl"
        target="_blank"
        variant="outline"
        color="neutral"
        icon="i-lucide-video"
        class="cursor-pointer"
      >
        Session Replays
      </UButton>
      <NuxtLink :to="`/analytics/${appName}/search`">
        <UButton variant="outline" color="neutral" icon="i-lucide-search" class="cursor-pointer">
          GSC Search
        </UButton>
      </NuxtLink>
      <UButton
        v-if="inspectionLink"
        :to="inspectionLink"
        target="_blank"
        variant="outline"
        color="neutral"
        icon="i-lucide-bar-chart-3"
        class="cursor-pointer"
      >
        View in GSC
      </UButton>
      <UButton
        :loading="indexnowLoading"
        class="cursor-pointer"
        icon="i-lucide-send"
        @click="submitIndexnow()"
      >
        IndexNow Submit
      </UButton>
      <NuxtLink to="/analytics">
        <UButton variant="ghost" color="neutral" icon="i-lucide-arrow-left" class="cursor-pointer">
          Back to fleet
        </UButton>
      </NuxtLink>
    </div>
  </UCard>
</template>
