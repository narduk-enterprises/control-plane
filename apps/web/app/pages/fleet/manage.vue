<script setup lang="ts">
import type { FleetDatabaseBackend } from '~/types/fleet'
import type { FleetApp } from '~/composables/useFleet'

type AuthProvider = 'apple' | 'email'
type DatabaseBackend = FleetDatabaseBackend

type FleetFormState = {
  url: string
  dopplerProject: string
  databaseBackend: DatabaseBackend
  d1DatabaseName: string
  gaPropertyId: string
  gaMeasurementId: string
  posthogAppName: string
  githubRepo: string
  authEnabled: boolean
  redirectBaseUrl: string
  loginPath: string
  callbackPath: string
  logoutPath: string
  confirmPath: string
  resetPath: string
  publicSignup: boolean
  providers: AuthProvider[]
  requireMfa: boolean
}

const authProviderOrder: AuthProvider[] = ['apple', 'email']
const databaseBackendItems = [
  { value: 'd1', label: 'Cloudflare D1' },
  { value: 'postgres', label: 'Postgres / Neon' },
] satisfies Array<{ value: DatabaseBackend; label: string }>
const authProviderItems = [
  { value: 'apple', label: 'Sign in with Apple', description: 'Primary fleet login path.' },
  { value: 'email', label: 'Email', description: 'Fallback login and recovery path.' },
]
const defaultAuthPaths = {
  loginPath: '/login',
  callbackPath: '/auth/callback',
  logoutPath: '/logout',
  confirmPath: '/auth/confirm',
  resetPath: '/reset-password',
}

useSeo({
  robots: 'noindex',
  title: 'Manage Fleet',
  description: 'Add, edit, and manage fleet app registrations.',
})
useWebPageSchema({
  name: 'Narduk Control Plane — Manage Fleet',
  description: 'Fleet app registry management.',
})

const toast = useToast()

const {
  rawApps: allApps,
  forceRefreshApps,
  isLoading,
  adminAddApp,
  adminEditApp,
  adminToggleApp,
  adminDeleteApp,
} = useFleet({ includeInactive: true })
const sortedApps = computed(() =>
  [...(allApps.value ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
)
const activeCount = computed(() => sortedApps.value.filter((a) => a.isActive !== false).length)
const inactiveCount = computed(() => sortedApps.value.filter((a) => a.isActive === false).length)

// Add app modal
const showAddModal = ref(false)
const addForm = reactive({
  name: '',
  url: '',
  dopplerProject: '',
  databaseBackend: 'd1' as DatabaseBackend,
  d1DatabaseName: '',
  gaPropertyId: '',
  gaMeasurementId: '',
  posthogAppName: '',
  githubRepo: '',
  authEnabled: true,
  redirectBaseUrl: '',
  loginPath: defaultAuthPaths.loginPath,
  callbackPath: defaultAuthPaths.callbackPath,
  logoutPath: defaultAuthPaths.logoutPath,
  confirmPath: defaultAuthPaths.confirmPath,
  resetPath: defaultAuthPaths.resetPath,
  publicSignup: true,
  providers: [...authProviderOrder] as AuthProvider[],
  requireMfa: false,
})
const isAdding = ref(false)

function resetAddForm() {
  addForm.name = ''
  addForm.url = ''
  addForm.dopplerProject = ''
  addForm.databaseBackend = 'd1'
  addForm.d1DatabaseName = ''
  addForm.gaPropertyId = ''
  addForm.gaMeasurementId = ''
  addForm.posthogAppName = ''
  addForm.githubRepo = ''
  resetAuthFields(addForm)
}

async function addApp() {
  if (!addForm.name || !addForm.url) return
  isAdding.value = true
  try {
    await adminAddApp({
      name: addForm.name,
      url: addForm.url,
      dopplerProject: addForm.dopplerProject || addForm.name,
      databaseBackend: addForm.databaseBackend,
      d1DatabaseName:
        addForm.databaseBackend === 'd1' ? addForm.d1DatabaseName || `${addForm.name}-db` : null,
      gaPropertyId: addForm.gaPropertyId || null,
      gaMeasurementId: addForm.gaMeasurementId || null,
      posthogAppName: addForm.posthogAppName || null,
      githubRepo: addForm.githubRepo || null,
      ...buildAuthPayload(addForm, addForm.url),
    })
    toast.add({
      title: 'App added',
      description: `${addForm.name} has been added to the fleet.`,
      color: 'success',
    })
    showAddModal.value = false
    resetAddForm()
    await forceRefreshApps()
  } catch (err) {
    const error = err as { data?: { message?: string }; message?: string }
    toast.add({
      title: 'Error',
      description: error.data?.message || error.message || 'Failed to add app',
      color: 'error',
    })
  } finally {
    isAdding.value = false
  }
}

// Edit app modal
const showEditModal = ref(false)
const editingApp = ref<FleetApp | null>(null)
const editForm = reactive({
  url: '',
  dopplerProject: '',
  databaseBackend: 'd1' as DatabaseBackend,
  d1DatabaseName: '',
  gaPropertyId: '',
  gaMeasurementId: '',
  posthogAppName: '',
  githubRepo: '',
  authEnabled: true,
  redirectBaseUrl: '',
  loginPath: defaultAuthPaths.loginPath,
  callbackPath: defaultAuthPaths.callbackPath,
  logoutPath: defaultAuthPaths.logoutPath,
  confirmPath: defaultAuthPaths.confirmPath,
  resetPath: defaultAuthPaths.resetPath,
  publicSignup: true,
  providers: [...authProviderOrder] as AuthProvider[],
  requireMfa: false,
})
const isEditing = ref(false)

function openEditModal(app: FleetApp) {
  editingApp.value = app
  editForm.url = app.url
  editForm.dopplerProject = app.dopplerProject || ''
  editForm.databaseBackend = app.databaseBackend || 'd1'
  editForm.d1DatabaseName = app.d1DatabaseName || ''
  editForm.gaPropertyId = app.gaPropertyId || ''
  editForm.gaMeasurementId = app.gaMeasurementId || ''
  editForm.posthogAppName = app.posthogAppName || ''
  editForm.githubRepo = app.githubRepo || ''
  editForm.authEnabled = app.authEnabled !== false
  editForm.redirectBaseUrl = app.redirectBaseUrl || app.url
  editForm.loginPath = app.loginPath || defaultAuthPaths.loginPath
  editForm.callbackPath = app.callbackPath || defaultAuthPaths.callbackPath
  editForm.logoutPath = app.logoutPath || defaultAuthPaths.logoutPath
  editForm.confirmPath = app.confirmPath || defaultAuthPaths.confirmPath
  editForm.resetPath = app.resetPath || defaultAuthPaths.resetPath
  editForm.publicSignup = app.publicSignup !== false
  editForm.providers = normalizeProviders(app.providers)
  editForm.requireMfa = app.requireMfa === true
  showEditModal.value = true
}

async function saveEdit() {
  if (!editingApp.value || !editForm.url) return
  isEditing.value = true
  try {
    await adminEditApp(editingApp.value.name, {
      url: editForm.url,
      dopplerProject: editForm.dopplerProject || editingApp.value.name,
      databaseBackend: editForm.databaseBackend,
      d1DatabaseName:
        editForm.databaseBackend === 'd1'
          ? editForm.d1DatabaseName || `${editingApp.value.name}-db`
          : null,
      gaPropertyId: editForm.gaPropertyId || null,
      gaMeasurementId: editForm.gaMeasurementId || null,
      posthogAppName: editForm.posthogAppName || null,
      githubRepo: editForm.githubRepo || null,
      ...buildAuthPayload(editForm, editForm.url),
    })
    toast.add({
      title: 'Updated',
      description: `${editingApp.value.name} has been updated.`,
      color: 'success',
    })
    showEditModal.value = false
    editingApp.value = null
    await forceRefreshApps()
  } catch (err) {
    const error = err as { data?: { message?: string }; message?: string }
    toast.add({
      title: 'Error',
      description: error.data?.message || error.message || 'Failed to update app',
      color: 'error',
    })
  } finally {
    isEditing.value = false
  }
}

// Toggle active/inactive
async function toggleActive(app: FleetApp) {
  const newState = app.isActive === false
  try {
    await adminToggleApp(app.name, newState)
    toast.add({
      title: newState ? 'Activated' : 'Deactivated',
      description: `${app.name} is now ${newState ? 'active' : 'inactive'}.`,
      color: newState ? 'success' : 'warning',
    })
    await forceRefreshApps()
  } catch (err) {
    const error = err as { data?: { message?: string }; message?: string }
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to update app',
      color: 'error',
    })
  }
}

// Delete app
async function deleteApp(app: FleetApp) {
  if (!confirm(`Permanently delete "${app.name}"? This cannot be undone.`)) return
  try {
    await adminDeleteApp(app.name)
    toast.add({
      title: 'Deleted',
      description: `${app.name} has been removed from the fleet.`,
      color: 'success',
    })
    await forceRefreshApps()
  } catch (err) {
    const error = err as { data?: { message?: string }; message?: string }
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to delete',
      color: 'error',
    })
  }
}

const breadcrumbItems = computed(() => [
  { label: 'Dashboard', to: '/' },
  { label: 'Fleet', to: '/fleet' },
  { label: 'Manage' },
])

function formatUrl(url: string) {
  return url.replace(/^https?:\/\//, '')
}

function resetAuthFields(
  form: Pick<
    FleetFormState,
    | 'authEnabled'
    | 'redirectBaseUrl'
    | 'loginPath'
    | 'callbackPath'
    | 'logoutPath'
    | 'confirmPath'
    | 'resetPath'
    | 'publicSignup'
    | 'providers'
    | 'requireMfa'
  >,
) {
  form.authEnabled = true
  form.redirectBaseUrl = ''
  form.loginPath = defaultAuthPaths.loginPath
  form.callbackPath = defaultAuthPaths.callbackPath
  form.logoutPath = defaultAuthPaths.logoutPath
  form.confirmPath = defaultAuthPaths.confirmPath
  form.resetPath = defaultAuthPaths.resetPath
  form.publicSignup = true
  form.providers = [...authProviderOrder]
  form.requireMfa = false
}

function normalizeProviders(providers?: FleetApp['providers']) {
  const selected = new Set((providers?.length ? providers : authProviderOrder) as AuthProvider[])
  return authProviderOrder.filter((provider) => selected.has(provider))
}

function buildAuthPayload(
  form: Pick<
    FleetFormState,
    | 'authEnabled'
    | 'redirectBaseUrl'
    | 'loginPath'
    | 'callbackPath'
    | 'logoutPath'
    | 'confirmPath'
    | 'resetPath'
    | 'publicSignup'
    | 'providers'
    | 'requireMfa'
  >,
  productionUrl: string,
) {
  return {
    authEnabled: form.authEnabled,
    redirectBaseUrl: form.authEnabled ? form.redirectBaseUrl || productionUrl : null,
    loginPath: form.loginPath || defaultAuthPaths.loginPath,
    callbackPath: form.callbackPath || defaultAuthPaths.callbackPath,
    logoutPath: form.logoutPath || defaultAuthPaths.logoutPath,
    confirmPath: form.confirmPath || defaultAuthPaths.confirmPath,
    resetPath: form.resetPath || defaultAuthPaths.resetPath,
    publicSignup: form.publicSignup,
    providers: normalizeProviders(form.providers),
    requireMfa: form.requireMfa,
  }
}

function authBadgeColor(app: FleetApp) {
  return app.authEnabled === false ? 'neutral' : 'primary'
}

function authProvidersLabel(app: FleetApp) {
  const providers = normalizeProviders(app.providers)
  if (providers.length === 2) return 'Apple + Email'
  return providers[0] === 'apple' ? 'Apple only' : 'Email only'
}

function databaseBackendLabel(app: FleetApp) {
  return (app.databaseBackend || 'd1') === 'postgres' ? 'Postgres' : 'D1'
}
</script>

<template>
  <div>
    <AppBreadcrumbs :items="breadcrumbItems" />
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="font-display text-2xl font-semibold text-default">Manage Fleet</h1>
        <p class="mt-1 text-sm text-muted">
          {{ activeCount }} active, {{ inactiveCount }} inactive — add, edit, or deactivate apps
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          variant="outline"
          color="neutral"
          icon="i-lucide-refresh-cw"
          class="cursor-pointer"
          :loading="isLoading"
          @click="forceRefreshApps()"
        >
          Refresh
        </UButton>
        <UButton icon="i-lucide-plus" class="cursor-pointer" @click="showAddModal = true">
          Add App
        </UButton>
      </div>
    </div>

    <!-- Apps list -->
    <div class="grid gap-3">
      <UCard
        v-for="app in sortedApps"
        :key="app.name"
        :class="[
          'transition-all duration-200',
          app.isActive === false ? 'opacity-50' : 'hover:shadow-elevated',
        ]"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="font-semibold text-default truncate">
                {{ app.name }}
              </h3>
              <UBadge v-if="app.isActive === false" variant="subtle" color="warning" size="xs">
                Inactive
              </UBadge>
            </div>
            <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <ULink
                :to="app.url"
                target="_blank"
                class="hover:text-primary transition-colors hover:underline flex items-center gap-1"
              >
                {{ formatUrl(app.url) }}
                <UIcon name="i-lucide-external-link" class="size-3 opacity-50" />
              </ULink>
              <span v-if="app.gaPropertyId" class="flex items-center gap-1">
                <UIcon name="i-lucide-bar-chart-2" class="size-3" />
                GA: {{ app.gaPropertyId }}
              </span>
              <span v-if="app.githubRepo" class="flex items-center gap-1">
                <UIcon name="i-lucide-github" class="size-3" />
                {{ app.githubRepo }}
              </span>
              <span v-if="app.posthogAppName" class="flex items-center gap-1">
                <UIcon name="i-lucide-users" class="size-3" />
                {{ app.posthogAppName }}
              </span>
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <UBadge
                :color="app.databaseBackend === 'postgres' ? 'success' : 'neutral'"
                variant="soft"
                size="xs"
              >
                {{ databaseBackendLabel(app) }}
              </UBadge>
              <UBadge
                v-if="(app.databaseBackend || 'd1') === 'd1' && app.d1DatabaseName"
                color="neutral"
                variant="soft"
                size="xs"
              >
                {{ app.d1DatabaseName }}
              </UBadge>
              <UBadge :color="authBadgeColor(app)" variant="subtle" size="xs">
                {{ app.authEnabled === false ? 'Auth Disabled' : 'Shared Auth' }}
              </UBadge>
              <UBadge v-if="app.authEnabled !== false" color="neutral" variant="soft" size="xs">
                {{ authProvidersLabel(app) }}
              </UBadge>
              <UBadge
                v-if="app.authEnabled !== false"
                :color="app.publicSignup === false ? 'warning' : 'success'"
                variant="soft"
                size="xs"
              >
                {{ app.publicSignup === false ? 'Signup Closed' : 'Public Signup' }}
              </UBadge>
              <UBadge
                v-if="app.authEnabled !== false"
                :color="app.requireMfa ? 'warning' : 'neutral'"
                variant="soft"
                size="xs"
              >
                {{ app.requireMfa ? 'MFA Ready' : 'MFA Optional' }}
              </UBadge>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <UButton
              v-if="app.isActive === false"
              icon="i-lucide-power"
              size="xs"
              variant="soft"
              color="success"
              class="cursor-pointer"
              @click="toggleActive(app)"
            >
              Activate
            </UButton>
            <UTooltip text="Edit">
              <UButton
                icon="i-lucide-pencil"
                size="xs"
                variant="ghost"
                color="neutral"
                class="cursor-pointer"
                @click="openEditModal(app)"
              />
            </UTooltip>
            <UTooltip v-if="app.isActive !== false" text="Deactivate">
              <UButton
                icon="i-lucide-eye-off"
                size="xs"
                variant="ghost"
                color="warning"
                class="cursor-pointer"
                @click="toggleActive(app)"
              />
            </UTooltip>
            <UTooltip text="Delete permanently">
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                variant="ghost"
                color="error"
                class="cursor-pointer"
                @click="deleteApp(app)"
              />
            </UTooltip>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Empty state -->
    <UCard v-if="!isLoading && sortedApps.length === 0">
      <div class="rounded-lg border border-dashed border-default p-8 text-center">
        <UIcon name="i-lucide-inbox" class="mx-auto size-10 text-muted" />
        <p class="mt-2 text-sm font-medium text-default">No fleet apps</p>
        <p class="mt-1 text-sm text-muted">Click "Add App" to register your first fleet app.</p>
      </div>
    </UCard>

    <!-- Add App Modal -->
    <UModal v-model:open="showAddModal">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-default">Add Fleet App</h3>
          <UButton
            icon="i-lucide-x"
            size="xs"
            variant="ghost"
            color="neutral"
            class="cursor-pointer"
            @click="showAddModal = false"
          />
        </div>
      </template>

      <template #body>
        <div class="flex flex-col gap-4">
          <UFormField label="App Name" required>
            <UInput v-model="addForm.name" placeholder="my-app-name" class="w-full" />
          </UFormField>
          <UFormField label="Production URL" required>
            <UInput v-model="addForm.url" placeholder="https://my-app.nard.uk" class="w-full" />
          </UFormField>
          <UFormField label="Doppler Project" hint="Defaults to app name">
            <UInput
              v-model="addForm.dopplerProject"
              :placeholder="addForm.name || 'my-app-name'"
              class="w-full"
            />
          </UFormField>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Database Backend">
              <USelect
                v-model="addForm.databaseBackend"
                :items="databaseBackendItems"
                value-attribute="value"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="addForm.databaseBackend === 'd1'"
              label="Default D1 Database Name"
              :hint="`Leave blank to use ${addForm.name || 'my-app-name'}-db`"
            >
              <UInput
                v-model="addForm.d1DatabaseName"
                :placeholder="addForm.name ? `${addForm.name}-db` : 'my-app-db'"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="GA4 Property ID" hint="Numeric ID for Reporting API">
            <UInput v-model="addForm.gaPropertyId" placeholder="526067189" class="w-full" />
          </UFormField>
          <UFormField label="GA Measurement ID" hint="G-XXXXXXXX from runtime config">
            <UInput v-model="addForm.gaMeasurementId" placeholder="G-XXXXXXXXXX" class="w-full" />
          </UFormField>
          <UFormField label="PostHog App Name" hint="Only if different from app name">
            <UInput v-model="addForm.posthogAppName" placeholder="My App Name" class="w-full" />
          </UFormField>
          <UFormField label="GitHub Repo">
            <UInput
              v-model="addForm.githubRepo"
              placeholder="narduk-enterprises/my-app-name"
              class="w-full"
            />
          </UFormField>
          <div class="rounded-2xl border border-default/60 bg-elevated/40 p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-default">Shared Auth on auth.nard.uk</p>
                <p class="mt-1 text-xs text-muted">
                  Keep the app on first-party cookies, but register the exact callback and email
                  flow URLs here.
                </p>
              </div>
              <UCheckbox v-model="addForm.authEnabled" label="Enabled" />
            </div>

            <div v-if="addForm.authEnabled" class="mt-4 flex flex-col gap-4">
              <UFormField
                label="Redirect Base URL"
                hint="Defaults to the production URL when left blank"
              >
                <UInput
                  v-model="addForm.redirectBaseUrl"
                  :placeholder="addForm.url || 'https://my-app.nard.uk'"
                  class="w-full"
                />
              </UFormField>

              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField label="Login Path">
                  <UInput v-model="addForm.loginPath" placeholder="/login" class="w-full" />
                </UFormField>
                <UFormField label="Callback Path">
                  <UInput
                    v-model="addForm.callbackPath"
                    placeholder="/auth/callback"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Logout Path">
                  <UInput v-model="addForm.logoutPath" placeholder="/logout" class="w-full" />
                </UFormField>
                <UFormField label="Confirm Path">
                  <UInput
                    v-model="addForm.confirmPath"
                    placeholder="/auth/confirm"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Reset Path" class="sm:col-span-2">
                  <UInput
                    v-model="addForm.resetPath"
                    placeholder="/reset-password"
                    class="w-full"
                  />
                </UFormField>
              </div>

              <div class="flex flex-col gap-3">
                <UFormField label="Providers" hint="Apple should stay enabled for public apps.">
                  <UCheckboxGroup
                    v-model="addForm.providers"
                    :items="authProviderItems"
                    legend="Auth providers"
                  />
                </UFormField>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <UCheckbox v-model="addForm.publicSignup" label="Public signup enabled" />
                <UCheckbox v-model="addForm.requireMfa" label="Require MFA for this app" />
              </div>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            variant="outline"
            color="neutral"
            class="cursor-pointer"
            @click="showAddModal = false"
          >
            Cancel
          </UButton>
          <UButton
            :loading="isAdding"
            :disabled="!addForm.name || !addForm.url"
            class="cursor-pointer"
            @click="addApp()"
          >
            Add App
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Edit App Modal -->
    <UModal v-model:open="showEditModal">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-default">Edit {{ editingApp?.name }}</h3>
          <UButton
            icon="i-lucide-x"
            size="xs"
            variant="ghost"
            color="neutral"
            class="cursor-pointer"
            @click="showEditModal = false"
          />
        </div>
      </template>

      <template #body>
        <div class="flex flex-col gap-4">
          <UFormField label="Production URL" required>
            <UInput v-model="editForm.url" placeholder="https://my-app.nard.uk" class="w-full" />
          </UFormField>
          <UFormField label="Doppler Project">
            <UInput
              v-model="editForm.dopplerProject"
              :placeholder="editingApp?.name || 'my-app-name'"
              class="w-full"
            />
          </UFormField>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Database Backend">
              <USelect
                v-model="editForm.databaseBackend"
                :items="databaseBackendItems"
                value-attribute="value"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="editForm.databaseBackend === 'd1'"
              label="Default D1 Database Name"
              :hint="`Leave blank to use ${editingApp?.name || 'my-app-name'}-db`"
            >
              <UInput
                v-model="editForm.d1DatabaseName"
                :placeholder="editingApp?.name ? `${editingApp.name}-db` : 'my-app-db'"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="GA4 Property ID" hint="Numeric ID for Reporting API">
            <UInput v-model="editForm.gaPropertyId" placeholder="526067189" class="w-full" />
          </UFormField>
          <UFormField label="GA Measurement ID" hint="G-XXXXXXXX from runtime config">
            <UInput v-model="editForm.gaMeasurementId" placeholder="G-XXXXXXXXXX" class="w-full" />
          </UFormField>
          <UFormField label="PostHog App Name" hint="Only if different from app name">
            <UInput v-model="editForm.posthogAppName" placeholder="My App Name" class="w-full" />
          </UFormField>
          <UFormField label="GitHub Repo">
            <UInput
              v-model="editForm.githubRepo"
              placeholder="narduk-enterprises/my-app-name"
              class="w-full"
            />
          </UFormField>
          <div class="rounded-2xl border border-default/60 bg-elevated/40 p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-default">Shared Auth on auth.nard.uk</p>
                <p class="mt-1 text-xs text-muted">
                  These values generate the redirect allow-list and the per-app auth contract.
                </p>
              </div>
              <UCheckbox v-model="editForm.authEnabled" label="Enabled" />
            </div>

            <div v-if="editForm.authEnabled" class="mt-4 flex flex-col gap-4">
              <UFormField
                label="Redirect Base URL"
                hint="Defaults to the production URL when left blank"
              >
                <UInput
                  v-model="editForm.redirectBaseUrl"
                  :placeholder="editForm.url || 'https://my-app.nard.uk'"
                  class="w-full"
                />
              </UFormField>

              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField label="Login Path">
                  <UInput v-model="editForm.loginPath" placeholder="/login" class="w-full" />
                </UFormField>
                <UFormField label="Callback Path">
                  <UInput
                    v-model="editForm.callbackPath"
                    placeholder="/auth/callback"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Logout Path">
                  <UInput v-model="editForm.logoutPath" placeholder="/logout" class="w-full" />
                </UFormField>
                <UFormField label="Confirm Path">
                  <UInput
                    v-model="editForm.confirmPath"
                    placeholder="/auth/confirm"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Reset Path" class="sm:col-span-2">
                  <UInput
                    v-model="editForm.resetPath"
                    placeholder="/reset-password"
                    class="w-full"
                  />
                </UFormField>
              </div>

              <div class="flex flex-col gap-3">
                <UFormField label="Providers" hint="Apple should stay enabled for public apps.">
                  <UCheckboxGroup
                    v-model="editForm.providers"
                    :items="authProviderItems"
                    legend="Auth providers"
                  />
                </UFormField>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <UCheckbox v-model="editForm.publicSignup" label="Public signup enabled" />
                <UCheckbox v-model="editForm.requireMfa" label="Require MFA for this app" />
              </div>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            variant="outline"
            color="neutral"
            class="cursor-pointer"
            @click="showEditModal = false"
          >
            Cancel
          </UButton>
          <UButton
            :loading="isEditing"
            :disabled="!editForm.url"
            class="cursor-pointer"
            @click="saveEdit()"
          >
            Save Changes
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
