<script setup lang="ts">
useSeo({
  title: 'Settings',
  description: 'Control Plane configuration and integrations.',
})
useWebPageSchema({
  name: 'Narduk Control Plane — Settings',
  description: 'Settings and configuration.',
})

const config = useRuntimeConfig().public
const breadcrumbItems = [{ label: 'Dashboard', to: '/' }, { label: 'Settings' }]

const integrations = computed(() => [
  { name: 'PostHog', configured: !!(config.posthogPublicKey && config.posthogProjectId), hint: 'Analytics' },
  { name: 'GA4', configured: !!(config.gaMeasurementId || config.gaPropertyId), hint: 'Google Analytics' },
  { name: 'IndexNow', configured: !!config.indexNowKey, hint: 'Search engines' },
])
</script>

<template>
  <div>
    <AppBreadcrumbs :items="breadcrumbItems" />
    <h1 class="font-display text-2xl font-semibold text-default">
      Settings
    </h1>
    <p class="mt-1 mb-6 text-sm text-muted">
      Configuration and integration status
    </p>

    <UCard>
      <template #header>
        <h2 class="font-semibold text-default">Integrations</h2>
      </template>
      <ul class="space-y-3">
        <li
          v-for="int in integrations"
          :key="int.name"
          class="flex items-center justify-between rounded-lg border border-default px-4 py-3"
        >
          <div>
            <p class="font-medium text-default">{{ int.name }}</p>
            <p class="text-sm text-muted">{{ int.hint }}</p>
          </div>
          <UBadge
            :color="int.configured ? 'success' : 'neutral'"
            variant="soft"
          >
            {{ int.configured ? 'Configured' : 'Not set' }}
          </UBadge>
        </li>
      </ul>
    </UCard>

    <UCard class="mt-6">
      <template #header>
        <h2 class="font-semibold text-default">Fleet registry</h2>
      </template>
      <p class="text-sm text-muted">
        Fleet apps are defined in <code class="rounded bg-muted px-1 py-0.5">server/data/fleet-registry.ts</code>.
        URLs are taken from <code class="rounded bg-muted px-1 py-0.5">KNOWN_URLS</code> (keep in sync with
        <code class="rounded bg-muted px-1 py-0.5">.agents/app-standardization/analytics-architecture.md</code>
        and each app’s Doppler <code class="rounded bg-muted px-1 py-0.5">SITE_URL</code> prd). Apps not in KNOWN_URLS use
        <code class="rounded bg-muted px-1 py-0.5">https://&lt;dopplerProject&gt;.nard.uk</code>.
      </p>
      <p class="mt-3 text-sm text-muted">
        For fleet GA4/GSC/PostHog to work, set in this app’s Doppler (prd):
        <code class="rounded bg-muted px-1 py-0.5">GA_PROPERTY_ID</code>,
        <code class="rounded bg-muted px-1 py-0.5">GSC_SERVICE_ACCOUNT_JSON</code>,
        <code class="rounded bg-muted px-1 py-0.5">POSTHOG_PERSONAL_API_KEY</code>,
        <code class="rounded bg-muted px-1 py-0.5">POSTHOG_PROJECT_ID</code> (e.g. from narduk-analytics hub).
        <br>
        For this dashboard's own endpoints, set
        <code class="rounded bg-muted px-1 py-0.5">GA_MEASUREMENT_ID</code>
        and <code class="rounded bg-muted px-1 py-0.5">INDEXNOW_KEY</code>.
      </p>
    </UCard>
  </div>
</template>
