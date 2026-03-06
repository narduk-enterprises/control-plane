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
  {
    name: 'PostHog',
    icon: 'i-lucide-users',
    configured: !!(config.posthogPublicKey && config.posthogProjectId),
    hint: 'Analytics & Events',
  },
  {
    name: 'GA4',
    icon: 'i-lucide-activity',
    configured: !!(config.gaMeasurementId || config.gaPropertyId),
    hint: 'Google Analytics',
  },
  {
    name: 'IndexNow',
    icon: 'i-lucide-globe',
    configured: !!config.indexNowKey,
    hint: 'Search engine indexing',
  },
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
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }; statusMessage?: string }
    passwordError.value = err.data?.message || err.statusMessage || 'Failed to change password'
  } finally {
    passwordLoading.value = false
  }
}

async function handleLogout() {
  await logout()
  await navigateTo('/login')
}

// API Keys
const {
  keys: apiKeysList,
  loading: apiKeysLoading,
  fetchKeys: fetchApiKeys,
  createKey,
  deleteKey,
} = useApiKeys()

const newKeyName = ref('')
const newKeyLoading = ref(false)
const newKeyRaw = ref('') // shown once after creation
const newKeyCopied = ref(false)
const deleteKeyId = ref<string | null>(null)

async function handleCreateKey() {
  if (!newKeyName.value.trim()) return
  newKeyLoading.value = true
  newKeyRaw.value = ''
  newKeyCopied.value = false
  try {
    newKeyRaw.value = await createKey(newKeyName.value.trim())
    newKeyName.value = ''
  } catch {
    /* ignore */
  } finally {
    newKeyLoading.value = false
  }
}

async function handleDeleteKey(id: string) {
  try {
    await deleteKey(id)
    deleteKeyId.value = null
  } catch {
    /* ignore */
  }
}

function copyKey() {
  navigator.clipboard.writeText(newKeyRaw.value)
  newKeyCopied.value = true
}

function formatDate(iso: string | null) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(() => {
  fetchApiKeys()
})
</script>

<template>
  <div>
    <AppBreadcrumbs :items="breadcrumbItems" />
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="font-display text-2xl font-semibold text-default">Settings</h1>
        <p class="mt-1 text-sm text-muted">Configuration, integrations, and account management</p>
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
        <h2 class="font-semibold text-default">Account</h2>
      </template>
      <div class="flex items-center gap-4">
        <div
          class="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
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
        <UBadge v-if="user.isAdmin" color="primary" variant="soft" class="ml-auto"> Admin </UBadge>
      </div>
    </UCard>

    <!-- Change Password -->
    <UCard class="mb-6">
      <template #header>
        <h2 class="font-semibold text-default">Change Password</h2>
      </template>
      <UForm
        :state="{ currentPassword, newPassword, confirmPassword }"
        class="max-w-md space-y-4"
        @submit="handleChangePassword"
      >
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

        <div
          v-if="passwordError"
          class="rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error"
        >
          {{ passwordError }}
        </div>
        <div
          v-if="passwordSuccess"
          class="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success"
        >
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

    <!-- API Keys -->
    <UCard class="mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-default">API Keys</h2>
          <UBadge color="neutral" variant="soft">
            {{ apiKeysList.length }} key{{ apiKeysList.length === 1 ? '' : 's' }}
          </UBadge>
        </div>
      </template>

      <p class="mb-4 text-sm text-muted">
        API keys allow CLI tools and scripts to authenticate without a browser session. Keys use the
        <code class="rounded bg-muted px-1 py-0.5">nk_</code> prefix and are hashed — you can only
        see the full key once when it's created.
      </p>

      <!-- Create new key -->
      <div class="mb-4 flex items-end gap-3">
        <UFormField label="Key name" class="flex-1">
          <UInput v-model="newKeyName" placeholder="e.g. validate-fleet CLI" icon="i-lucide-tag" />
        </UFormField>
        <UButton
          label="Generate Key"
          icon="i-lucide-plus"
          :loading="newKeyLoading"
          :disabled="!newKeyName.trim()"
          class="cursor-pointer"
          @click="handleCreateKey"
        />
      </div>

      <!-- Raw key display (shown once) -->
      <div v-if="newKeyRaw" class="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-4">
        <p class="mb-2 text-sm font-medium text-warning">
          ⚠️ Copy this key now — it won't be shown again
        </p>
        <div class="flex items-center gap-2">
          <code class="flex-1 break-all rounded bg-muted px-3 py-2 font-mono text-sm text-default">
            {{ newKeyRaw }}
          </code>
          <UButton
            :icon="newKeyCopied ? 'i-lucide-check' : 'i-lucide-copy'"
            :color="newKeyCopied ? 'success' : 'neutral'"
            variant="outline"
            class="cursor-pointer"
            @click="copyKey"
          />
        </div>
      </div>

      <!-- Existing keys table -->
      <div v-if="apiKeysLoading" class="py-4 text-center text-sm text-muted">Loading…</div>
      <div v-else-if="apiKeysList.length === 0" class="py-4 text-center text-sm text-muted">
        No API keys yet.
      </div>
      <ul v-else class="space-y-2">
        <li
          v-for="key in apiKeysList"
          :key="key.id"
          class="flex items-center justify-between rounded-lg border border-default px-4 py-3 transition-colors hover:bg-elevated/50"
        >
          <div class="min-w-0 flex-1">
            <p class="font-medium text-default">
              {{ key.name }}
            </p>
            <p class="text-sm text-muted">
              <code class="rounded bg-muted px-1 py-0.5 font-mono">{{ key.keyPrefix }}…</code>
              · Created {{ formatDate(key.createdAt) }} · Last used {{ formatDate(key.lastUsedAt) }}
            </p>
          </div>
          <div v-if="deleteKeyId === key.id" class="flex items-center gap-2">
            <span class="text-sm text-error">Delete?</span>
            <UButton
              size="xs"
              color="error"
              label="Yes"
              class="cursor-pointer"
              @click="handleDeleteKey(key.id)"
            />
            <UButton
              size="xs"
              variant="outline"
              label="No"
              class="cursor-pointer"
              @click="deleteKeyId = null"
            />
          </div>
          <UButton
            v-else
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="xs"
            class="cursor-pointer"
            @click="deleteKeyId = key.id"
          />
        </li>
      </ul>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold text-default">Integrations</h2>
      </template>
      <ul class="space-y-3">
        <li
          v-for="int in integrations"
          :key="int.name"
          class="flex items-center justify-between rounded-lg border border-default px-4 py-3 transition-colors hover:bg-elevated/50"
        >
          <div class="flex items-center gap-3">
            <div
              class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
            >
              <UIcon :name="int.icon" class="size-5" />
            </div>
            <div>
              <p class="font-medium text-default">{{ int.name }}</p>
              <p class="text-sm text-muted">{{ int.hint }}</p>
            </div>
          </div>
          <UBadge :color="int.configured ? 'success' : 'neutral'" variant="soft">
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
        Fleet apps are defined in
        <code class="rounded bg-muted px-1 py-0.5">server/data/fleet-registry.ts</code>. URLs are
        taken from <code class="rounded bg-muted px-1 py-0.5">KNOWN_URLS</code> (keep in sync with
        <code class="rounded bg-muted px-1 py-0.5"
          >.agents/app-standardization/analytics-architecture.md</code
        >
        and each app's Doppler <code class="rounded bg-muted px-1 py-0.5">SITE_URL</code> prd). Apps
        not in KNOWN_URLS use
        <code class="rounded bg-muted px-1 py-0.5">https://&lt;dopplerProject&gt;.nard.uk</code>.
      </p>
      <p class="mt-3 text-sm text-muted">
        For fleet GA4/GSC/PostHog to work, set in this app's Doppler (prd):
        <code class="rounded bg-muted px-1 py-0.5">GA_PROPERTY_ID</code>,
        <code class="rounded bg-muted px-1 py-0.5">GSC_SERVICE_ACCOUNT_JSON</code>,
        <code class="rounded bg-muted px-1 py-0.5">POSTHOG_PERSONAL_API_KEY</code>,
        <code class="rounded bg-muted px-1 py-0.5">POSTHOG_PROJECT_ID</code> (from the
        narduk-nuxt-template Doppler project).
        <br />
        For this dashboard's own endpoints, set
        <code class="rounded bg-muted px-1 py-0.5">GA_MEASUREMENT_ID</code>
        and <code class="rounded bg-muted px-1 py-0.5">INDEXNOW_KEY</code>.
      </p>
    </UCard>
  </div>
</template>
