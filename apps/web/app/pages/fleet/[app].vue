<script setup lang="ts">
const route = useRoute()
const appName = computed(() => (route.params.app as string) ?? '')

useHead({
  title: computed(() => `${appName.value} — Fleet`),
})
useSeo({
  title: 'Fleet App',
  description: 'GA4, GSC, PostHog, IndexNow analytics for a fleet app.',
})
useWebPageSchema({
  name: 'Fleet App Analytics',
  description: 'App analytics dashboard.',
})

const tabs = [
  { label: 'Google Analytics', value: 'ga4', icon: 'i-lucide-bar-chart-2' },
  { label: 'GSC', value: 'gsc', icon: 'i-lucide-bar-chart-3' },
  { label: 'PostHog', value: 'posthog', icon: 'i-lucide-users' },
  { label: 'IndexNow', value: 'indexnow', icon: 'i-lucide-send' },
]
const router = useRouter()
const activeTab = computed({
  get: () => (route.query.tab as string) || 'ga4',
  set: (val) => router.replace({ query: { ...route.query, tab: val } })
})

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
        Google Analytics, Search Console, PostHog, and IndexNow for this app
      </p>
    </div>

    <div class="flex gap-1 rounded-lg border border-default p-1 shadow-xs">
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

    <UCard v-show="activeTab === 'ga4'" class="mt-4">
      <FleetAppGAPanel :app-name="appName" :active="activeTab === 'ga4'" />
    </UCard>
    <UCard v-show="activeTab === 'gsc'" class="mt-4">
      <FleetAppGscPanel :app-name="appName" :active="activeTab === 'gsc'" />
    </UCard>
    <UCard v-show="activeTab === 'posthog'" class="mt-4">
      <FleetAppPosthogPanel :app-name="appName" :active="activeTab === 'posthog'" />
    </UCard>
    <UCard v-show="activeTab === 'indexnow'" class="mt-4">
      <FleetAppIndexnowPanel :app-name="appName" :active="activeTab === 'indexnow'" />
    </UCard>
  </div>
</template>
