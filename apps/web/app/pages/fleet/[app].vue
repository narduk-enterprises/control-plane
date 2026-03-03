<script setup lang="ts">
const route = useRoute()
const appName = computed(() => (route.params.app as string) ?? '')

useSeo({
  title: () => `${appName.value} — Fleet`,
  description: () => `GSC, PostHog, IndexNow for ${appName.value}.`,
})
useWebPageSchema({
  name: () => `Fleet — ${appName.value}`,
  description: () => `App analytics for ${appName.value}.`,
})

const tabs = [
  { label: 'GSC', value: 'gsc', icon: 'i-lucide-bar-chart-3' },
  { label: 'PostHog', value: 'posthog', icon: 'i-lucide-users' },
  { label: 'IndexNow', value: 'indexnow', icon: 'i-lucide-send' },
]
const activeTab = ref('gsc')

const breadcrumbItems = computed(() => [
  { label: 'Dashboard', to: '/' },
  { label: 'Fleet', to: '/fleet' },
  { label: appName.value },
])
</script>

<template>
  <div>
    <AppBreadcrumbs :items="breadcrumbItems" />
    <div class="mb-6">
      <h1 class="font-display text-2xl font-semibold text-default">
        {{ appName }}
      </h1>
      <p class="mt-1 text-sm text-muted">
        Search Console, PostHog, and IndexNow for this app
      </p>
    </div>

    <div class="flex gap-1 rounded-lg border border-default p-1">
      <UButton
        v-for="tab in tabs"
        :key="tab.value"
        variant="ghost"
        :color="activeTab === tab.value ? 'primary' : 'neutral'"
        class="flex-1 cursor-pointer"
        @click="activeTab = tab.value"
      >
        <UIcon :name="tab.icon" class="size-4" />
        {{ tab.label }}
      </UButton>
    </div>

    <UCard v-show="activeTab === 'gsc'" class="mt-4">
      <FleetAppGscPanel :app-name="appName" />
    </UCard>
    <UCard v-show="activeTab === 'posthog'" class="mt-4">
      <FleetAppPosthogPanel :app-name="appName" />
    </UCard>
    <UCard v-show="activeTab === 'indexnow'" class="mt-4">
      <FleetAppIndexnowPanel :app-name="appName" />
    </UCard>
  </div>
</template>
