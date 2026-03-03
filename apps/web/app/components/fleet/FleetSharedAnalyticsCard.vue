<script setup lang="ts">
defineProps<{
  providerName: 'Google Analytics' | 'PostHog'
  loading: boolean
  error: Error | null | undefined
  summary: {
    users?: number
    sessions?: number
    pageviews?: number
    bounceRate?: number
    avgSessionDuration?: number
    eventCount?: number
  } | null
  dateRange: string | null
  iconName: string
}>()

defineEmits<{
  (e: 'load'): void
}>()
</script>

<template>
  <div class="space-y-4">
    <UButton
      :loading="loading"
      class="cursor-pointer"
      @click="$emit('load')"
    >
      Load {{ providerName }} (last 30 days)
    </UButton>

    <div v-if="error" class="rounded-lg border border-error/30 bg-error/5 p-4">
      <p class="text-sm font-medium text-error">{{ providerName }} error</p>
      <p class="mt-1 text-sm text-muted">{{ error.message || 'An unknown error occurred' }}</p>
    </div>

    <div v-else-if="summary" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <!-- Users -->
      <div v-if="summary.users !== undefined" class="rounded-xl border border-default bg-elevated/30 p-4">
        <p class="text-sm font-medium text-muted">Unique Users</p>
        <p class="mt-1 text-2xl font-semibold text-default">
          {{ summary.users.toLocaleString() }}
        </p>
      </div>

      <!-- Sessions -->
      <div v-if="summary.sessions !== undefined" class="rounded-xl border border-default bg-elevated/30 p-4">
        <p class="text-sm font-medium text-muted">Sessions</p>
        <p class="mt-1 text-2xl font-semibold text-default">
          {{ summary.sessions.toLocaleString() }}
        </p>
      </div>

      <!-- Pageviews -->
      <div v-if="summary.pageviews !== undefined" class="rounded-xl border border-default bg-elevated/30 p-4">
        <p class="text-sm font-medium text-muted">Pageviews</p>
        <p class="mt-1 text-2xl font-semibold text-default">
          {{ summary.pageviews.toLocaleString() }}
        </p>
      </div>

      <!-- Event Count (PostHog Specific) -->
      <div v-if="summary.eventCount !== undefined && summary.eventCount > 0" class="rounded-xl border border-default bg-elevated/30 p-4">
        <p class="text-sm font-medium text-muted">Total Events</p>
        <p class="mt-1 text-2xl font-semibold text-default">
          {{ summary.eventCount.toLocaleString() }}
        </p>
      </div>

      <!-- Bounce Rate (GA Specific) -->
      <div v-if="summary.bounceRate !== undefined" class="rounded-xl border border-default bg-elevated/30 p-4">
        <p class="text-sm font-medium text-muted">Bounce Rate</p>
        <p class="mt-1 text-2xl font-semibold text-default">
          {{ (summary.bounceRate * 100).toFixed(1) }}%
        </p>
      </div>

      <!-- Avg Session Duration (GA Specific) -->
      <div v-if="summary.avgSessionDuration !== undefined" class="rounded-xl border border-default bg-elevated/30 p-4">
        <p class="text-sm font-medium text-muted">Avg Session</p>
        <p class="mt-1 text-2xl font-semibold text-default">
          <span v-if="summary.avgSessionDuration >= 60">
            {{ Math.floor(summary.avgSessionDuration / 60) }}m {{ Math.floor(summary.avgSessionDuration % 60) }}s
          </span>
          <span v-else>
            {{ Math.round(summary.avgSessionDuration) }}s
          </span>
        </p>
      </div>

      <p v-if="dateRange" class="col-span-full text-xs text-muted">
        {{ dateRange }}
      </p>
    </div>

    <div v-else class="rounded-lg border border-dashed border-default p-6 text-center">
      <UIcon :name="iconName" class="mx-auto size-10 text-muted" />
      <p class="mt-2 text-sm font-medium text-default">Load {{ providerName }} data</p>
      <p class="mt-1 text-sm text-muted">Click Load to fetch key metrics for the last 30 days.</p>
    </div>
  </div>
</template>
