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

const { user, logout } = useAuth()
const breadcrumbItems = [{ label: 'Dashboard', to: '/' }, { label: 'Settings' }]

// Password change form — state lives in composable
const {
  currentPassword,
  newPassword,
  confirmPassword,
  loading: passwordLoading,
  error: passwordError,
  success: passwordSuccess,
  submit: handleChangePassword,
} = usePasswordForm()

async function handleLogout() {
  await logout()
  await navigateTo('/login')
}

// API Keys — state lives in composable
const {
  apiKeysList,
  apiKeysLoading,
  newKeyName,
  newKeyLoading,
  newKeyRaw,
  newKeyCopied,
  deleteKeyId,
  handleCreate: handleCreateKey,
  handleDelete: handleDeleteKey,
  copyKey,
  formatDate,
} = useApiKeyForm()
</script>

<template>
  <div>
    <AppBreadcrumbs :items="breadcrumbItems" />
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="font-display text-2xl font-semibold text-default">Settings</h1>
        <p class="mt-1 text-sm text-muted">Account, API keys, and fleet registry notes</p>
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

    <UCard class="mt-6">
      <template #header>
        <h2 class="font-semibold text-default">Fleet registry</h2>
      </template>
      <p class="text-sm text-muted">
        Runtime fleet metadata comes from the D1
        <code class="rounded bg-muted px-1 py-0.5">fleet_apps</code> table. The legacy
        <code class="rounded bg-muted px-1 py-0.5">managed-repos.ts</code> catalog is now bootstrap
        data only and should not be treated as the live source of truth.
      </p>
      <p class="mt-3 text-sm text-muted">
        Required server-side secrets for analytics snapshots:
        <code class="rounded bg-muted px-1 py-0.5">GA_PROPERTY_ID</code>,
        <code class="rounded bg-muted px-1 py-0.5">GSC_SERVICE_ACCOUNT_JSON</code>,
        <code class="rounded bg-muted px-1 py-0.5">POSTHOG_PERSONAL_API_KEY</code>,
        <code class="rounded bg-muted px-1 py-0.5">POSTHOG_PROJECT_ID</code>, and
        <code class="rounded bg-muted px-1 py-0.5">GA_ACCOUNT_ID</code>. Live integration status is
        on the Analytics page.
      </p>
    </UCard>
  </div>
</template>
