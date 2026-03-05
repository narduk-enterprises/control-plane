<script setup lang="ts">
import type { FleetApp } from '~/composables/useFleet'

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
  refreshApps,
  isLoading,
  adminAddApp,
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
  gaPropertyId: '',
  gaMeasurementId: '',
  posthogAppName: '',
  githubRepo: '',
})
const isAdding = ref(false)

function resetAddForm() {
  addForm.name = ''
  addForm.url = ''
  addForm.dopplerProject = ''
  addForm.gaPropertyId = ''
  addForm.gaMeasurementId = ''
  addForm.posthogAppName = ''
  addForm.githubRepo = ''
}

async function addApp() {
  if (!addForm.name || !addForm.url) return
  isAdding.value = true
  try {
    await adminAddApp({
      name: addForm.name,
      url: addForm.url,
      dopplerProject: addForm.dopplerProject || addForm.name,
      gaPropertyId: addForm.gaPropertyId || null,
      gaMeasurementId: addForm.gaMeasurementId || null,
      posthogAppName: addForm.posthogAppName || null,
      githubRepo: addForm.githubRepo || null,
    })
    toast.add({
      title: 'App added',
      description: `${addForm.name} has been added to the fleet.`,
      color: 'success',
    })
    showAddModal.value = false
    resetAddForm()
    await refreshApps()
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
    await refreshApps()
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
    await refreshApps()
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
          @click="refreshApps()"
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
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <UTooltip :text="app.isActive === false ? 'Activate' : 'Deactivate'">
              <UButton
                :icon="app.isActive === false ? 'i-lucide-eye' : 'i-lucide-eye-off'"
                size="xs"
                variant="ghost"
                :color="app.isActive === false ? 'success' : 'warning'"
                class="cursor-pointer"
                @click="toggleActive(app)"
              />
            </UTooltip>
            <UTooltip text="View Analytics">
              <UButton
                :to="`/fleet/${app.name}`"
                icon="i-lucide-bar-chart-3"
                size="xs"
                variant="ghost"
                color="neutral"
                class="cursor-pointer"
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
      <template #content>
        <UCard>
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
          </div>

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
        </UCard>
      </template>
    </UModal>
  </div>
</template>
