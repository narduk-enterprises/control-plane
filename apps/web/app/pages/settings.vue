<script setup lang="ts">
useSeo({
  robots: 'noindex',
  title: 'Settings',
  description: 'Control Plane configuration and integrations.',
})
useWebPageSchema({
  name: 'Narduk Control Plane — Settings',
  description: 'Settings and configuration.',
})

const config = useRuntimeConfig().public
const { user, logout } = useAuth()
const breadcrumbItems = [{ label: 'Dashboard', to: '/' }, { label: 'Settings' }]

const integrations = computed(() => [
  { name: 'PostHog', icon: 'i-lucide-users', configured: !!(config.posthogPublicKey && config.posthogProjectId), hint: 'Analytics & Events' },
  { name: 'GA4', icon: 'i-lucide-activity', configured: !!(config.gaMeasurementId || config.gaPropertyId), hint: 'Google Analytics' },
  { name: 'IndexNow', icon: 'i-lucide-globe', configured: !!config.indexNowKey, hint: 'Search engine indexing' },
])

// Password change form
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordLoading = ref(false)
const passwordError = ref('')
const passwordSuccess = ref(false)

const authApi = useAuthApi()

async function handleChangePassword() {
  passwordError.value = ''
  passwordSuccess.value = false

  if (newPassword.value.length < 8) {
    passwordError.value = 'New password must be at least 8 characters'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'New passwords do not match'
    return
  }

  passwordLoading.value = true
  try {
    await authApi.changePassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    })
    passwordSuccess.value = true
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string }; statusMessage?: string }
    passwordError.value = err.data?.message || err.statusMessage || 'Failed to change password'
  }
  finally {
    passwordLoading.value = false
  }
}

async function handleLogout() {
  await logout()
  await navigateTo('/login')
}
</script>

<template>
  <div>
    <AppBreadcrumbs :items="breadcrumbItems" />
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="font-display text-2xl font-semibold text-default">
          Settings
        </h1>
        <p class="mt-1 text-sm text-muted">
          Configuration, integrations, and account management
        </p>
      </div>
      <UButton
        variant="outline"
        color="error"
        icon="i-lucide-log-out"
        class="cursor-pointer"
        @click="handleLogout"
      >
        Sign Out
      </UButton>
    </div>

    <!-- Account info -->
    <UCard v-if="user" class="mb-6">
      <template #header>
        <h2 class="font-semibold text-default">
          Account
        </h2>
      </template>
      <div class="flex items-center gap-4">
        <div class="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UIcon name="i-lucide-user" class="size-6" />
        </div>
        <div>
          <p class="font-medium text-default">
            {{ user.name || 'User' }}
          </p>
          <p class="text-sm text-muted">
            {{ user.email }}
          </p>
        </div>
        <UBadge v-if="user.isAdmin" color="primary" variant="soft" class="ml-auto">
          Admin
        </UBadge>
      </div>
    </UCard>

    <!-- Change Password -->
    <UCard class="mb-6">
      <template #header>
        <h2 class="font-semibold text-default">
          Change Password
        </h2>
      </template>
      <UForm :state="{ currentPassword, newPassword, confirmPassword }" class="max-w-md space-y-4" @submit="handleChangePassword">
        <UFormField label="Current Password">
          <UInput
            v-model="currentPassword"
            type="password"
            placeholder="••••••••"
            icon="i-lucide-lock"
            required
          />
        </UFormField>

        <UFormField label="New Password">
          <UInput
            v-model="newPassword"
            type="password"
            placeholder="••••••••"
            icon="i-lucide-key-round"
            required
          />
        </UFormField>

        <UFormField label="Confirm New Password">
          <UInput
            v-model="confirmPassword"
            type="password"
            placeholder="••••••••"
            icon="i-lucide-key-round"
            required
          />
        </UFormField>

        <div v-if="passwordError" class="rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error">
          {{ passwordError }}
        </div>
        <div v-if="passwordSuccess" class="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">
          Password changed successfully
        </div>

        <UButton
          type="submit"
          label="Update Password"
          icon="i-lucide-save"
          :loading="passwordLoading"
          class="cursor-pointer"
        />
      </UForm>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold text-default">
          Integrations
        </h2>
      </template>
      <ul class="space-y-3">
        <li
          v-for="int in integrations"
          :key="int.name"
          class="flex items-center justify-between rounded-lg border border-default px-4 py-3 transition-colors hover:bg-elevated/50"
        >
          <div class="flex items-center gap-3">
            <div class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UIcon :name="int.icon" class="size-5" />
            </div>
            <div>
              <p class="font-medium text-default">{{ int.name }}</p>
              <p class="text-sm text-muted">{{ int.hint }}</p>
            </div>
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
        <h2 class="font-semibold text-default">
          Fleet registry
        </h2>
      </template>
      <p class="text-sm text-muted">
        Fleet apps are defined in <code class="rounded bg-muted px-1 py-0.5">server/data/fleet-registry.ts</code>.
        URLs are taken from <code class="rounded bg-muted px-1 py-0.5">KNOWN_URLS</code> (keep in sync with
        <code class="rounded bg-muted px-1 py-0.5">.agents/app-standardization/analytics-architecture.md</code>
        and each app's Doppler <code class="rounded bg-muted px-1 py-0.5">SITE_URL</code> prd). Apps not in KNOWN_URLS use
        <code class="rounded bg-muted px-1 py-0.5">https://&lt;dopplerProject&gt;.nard.uk</code>.
      </p>
      <p class="mt-3 text-sm text-muted">
        For fleet GA4/GSC/PostHog to work, set in this app's Doppler (prd):
        <code class="rounded bg-muted px-1 py-0.5">GA_PROPERTY_ID</code>,
        <code class="rounded bg-muted px-1 py-0.5">GSC_SERVICE_ACCOUNT_JSON</code>,
        <code class="rounded bg-muted px-1 py-0.5">POSTHOG_PERSONAL_API_KEY</code>,
        <code class="rounded bg-muted px-1 py-0.5">POSTHOG_PROJECT_ID</code> (from the narduk-nuxt-template Doppler project).
        <br>
        For this dashboard's own endpoints, set
        <code class="rounded bg-muted px-1 py-0.5">GA_MEASUREMENT_ID</code>
        and <code class="rounded bg-muted px-1 py-0.5">INDEXNOW_KEY</code>.
      </p>
    </UCard>
  </div>
</template>

