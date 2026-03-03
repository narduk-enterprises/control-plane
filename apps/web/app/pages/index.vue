<script setup lang="ts">
useSeo({
  title: 'Dashboard',
  description: 'Narduk Control Plane — fleet overview and quick actions.',
  ogImage: { title: 'Narduk Control Plane Dashboard', description: 'Fleet dashboard.', icon: '⚙️' },
})
useWebPageSchema({
  name: 'Narduk Control Plane — Dashboard',
  description: 'Fleet dashboard overview.',
})

const { apps, refreshApps } = useFleetDashboard()
const fleetApps = computed(() => apps.value ?? [])
const recentFleetApps = computed(() => fleetApps.value.slice(0, 6))
const fleetCount = computed(() => fleetApps.value.length)
const hasFleetApps = computed(() => fleetCount.value > 0)
const lastRefresh = ref<Date | null>(null)

async function onRefresh() {
  await refreshApps()
  lastRefresh.value = new Date()
}
</script>

<template>
  <div>
    <AppBreadcrumbs :items="[{ label: 'Dashboard' }]" />
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="font-display text-2xl font-semibold text-default">
          Dashboard
        </h1>
        <p class="mt-1 text-sm text-muted">
          Fleet overview and quick actions
        </p>
      </div>
      <UButton
        variant="outline"
        color="neutral"
        icon="i-lucide-refresh-cw"
        class="cursor-pointer shrink-0"
        @click="onRefresh"
      >
        Refresh
      </UButton>
    </div>

    <!-- KPI cards -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      <UCard class="cursor-default transition-base hover:shadow-elevated">
        <div class="flex items-center gap-4">
          <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UIcon name="i-lucide-grid-3x3" class="size-6" />
          </div>
          <div>
            <p class="text-sm font-medium text-muted">Fleet apps</p>
            <p class="text-2xl font-semibold text-default">
              {{ fleetCount }}
            </p>
          </div>
        </div>
      </UCard>
      <UCard class="cursor-pointer transition-base hover:shadow-elevated" @click="navigateTo('/fleet')">
        <div class="flex items-center gap-4">
          <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UIcon name="i-lucide-bar-chart-3" class="size-6" />
          </div>
          <div>
            <p class="text-sm font-medium text-muted">GSC</p>
            <p class="text-sm text-default">View per app</p>
          </div>
        </div>
      </UCard>
      <UCard class="cursor-pointer transition-base hover:shadow-elevated" @click="navigateTo('/fleet')">
        <div class="flex items-center gap-4">
          <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UIcon name="i-lucide-users" class="size-6" />
          </div>
          <div>
            <p class="text-sm font-medium text-muted">PostHog</p>
            <p class="text-sm text-default">Events & users</p>
          </div>
        </div>
      </UCard>
      <UCard class="cursor-pointer transition-base hover:shadow-elevated" @click="navigateTo('/indexing')">
        <div class="flex items-center gap-4">
          <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UIcon name="i-lucide-search" class="size-6" />
          </div>
          <div>
            <p class="text-sm font-medium text-muted">Indexing</p>
            <p class="text-sm text-default">Submit URLs</p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Quick actions + recent fleet -->
    <div class="grid gap-8 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="font-semibold text-default">Fleet apps</h2>
              <UButton
                to="/fleet"
                variant="ghost"
                size="sm"
                class="cursor-pointer"
              >
                View all
              </UButton>
            </div>
          </template>
          <div v-if="hasFleetApps" class="space-y-2">
            <NuxtLink
              v-for="app in recentFleetApps"
              :key="app.name"
              :to="`/fleet/${app.name}`"
              class="flex items-center justify-between rounded-lg border border-default p-3 transition-colors hover:bg-elevated cursor-pointer"
            >
              <div class="min-w-0 flex-1">
                <p class="font-medium text-default truncate">{{ app.name }}</p>
                <p class="truncate text-sm text-muted">{{ app.url }}</p>
              </div>
              <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-muted" />
            </NuxtLink>
          </div>
          <div v-else class="rounded-lg border border-dashed border-default p-8 text-center">
            <UIcon name="i-lucide-inbox" class="mx-auto size-10 text-muted" />
            <p class="mt-2 text-sm font-medium text-default">No fleet apps</p>
            <p class="mt-1 text-sm text-muted">Ensure you are authenticated. Fleet list comes from the registry.</p>
          </div>
        </UCard>
      </div>
      <div>
        <UCard>
          <template #header>
            <h2 class="font-semibold text-default">Quick actions</h2>
          </template>
          <div class="flex flex-col gap-2">
            <UButton
              to="/fleet"
              variant="outline"
              color="neutral"
              block
              class="cursor-pointer justify-start"
              icon="i-lucide-grid-3x3"
            >
              Browse fleet
            </UButton>
            <UButton
              to="/indexing"
              variant="outline"
              color="neutral"
              block
              class="cursor-pointer justify-start"
              icon="i-lucide-send"
            >
              Submit URL to Google
            </UButton>
            <UButton
              to="/settings"
              variant="outline"
              color="neutral"
              block
              class="cursor-pointer justify-start"
              icon="i-lucide-settings"
            >
              Settings
            </UButton>
          </div>
        </UCard>
      </div>
    </div>

    <p v-if="lastRefresh" class="mt-6 text-xs text-muted">
      Last refreshed: <NuxtTime :datetime="lastRefresh" relative />
    </p>
  </div>
</template>
