<script setup lang="ts">
const props = defineProps<{ appName: string }>()

const { data, error, loading, load } = useFleetPosthog(() => props.appName)

const summary = computed(() => {
  const d = data.value
  if (!d || typeof d.summary !== 'object') return null
  const s = d.summary as Record<string, unknown>
  return {
    eventCount: Number(s.event_count ?? 0),
    uniqueUsers: Number(s.unique_users ?? 0),
  }
})

async function onLoad() {
  await load()
}
</script>

<template>
  <div class="space-y-4">
    <UButton
      :loading="loading"
      class="cursor-pointer"
      @click="onLoad"
    >
      Load PostHog (last 30 days)
    </UButton>

    <div v-if="error" class="rounded-lg border border-error/30 bg-error/5 p-4">
      <p class="text-sm font-medium text-error">PostHog error</p>
      <p class="mt-1 text-sm text-muted">{{ error.data?.message || error?.message }}</p>
    </div>

    <div v-else-if="summary" class="grid gap-4 sm:grid-cols-2">
      <div class="rounded-xl border border-default bg-elevated/30 p-4">
        <p class="text-sm font-medium text-muted">Events</p>
        <p class="mt-1 text-2xl font-semibold text-default">
          {{ summary.eventCount.toLocaleString() }}
        </p>
      </div>
      <div class="rounded-xl border border-default bg-elevated/30 p-4">
        <p class="text-sm font-medium text-muted">Unique users</p>
        <p class="mt-1 text-2xl font-semibold text-default">
          {{ summary.uniqueUsers.toLocaleString() }}
        </p>
      </div>
      <p v-if="data?.startDate" class="col-span-full text-xs text-muted">
        {{ data.startDate }} → {{ data.endDate }}
      </p>
    </div>

    <div v-else class="rounded-lg border border-dashed border-default p-6 text-center">
      <UIcon name="i-lucide-users" class="mx-auto size-10 text-muted" />
      <p class="mt-2 text-sm font-medium text-default">Load PostHog data</p>
      <p class="mt-1 text-sm text-muted">Click Load to fetch event count and unique users for the last 30 days.</p>
    </div>
  </div>
</template>
