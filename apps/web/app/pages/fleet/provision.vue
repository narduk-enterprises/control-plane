<script setup lang="ts">
import type { ProvisionJob } from '~/composables/useFleetProvision'

useSeo({
  robots: 'noindex',
  title: 'Provision App',
  description: 'Provision a new fleet app from the narduk-nuxt-template.',
})
useWebPageSchema({
  name: 'Narduk Control Plane — Provision App',
  description: 'Provision a new fleet app.',
})

const { jobs, activeJobs, refreshJobs, isProvisioning, provisionApp, retryJob } = useFleetProvision()

const toast = useToast()

const expandedJobs = ref(new Set<string>())
function toggleJob(id: string) {
  if (expandedJobs.value.has(id)) {
    expandedJobs.value.delete(id)
  } else {
    expandedJobs.value.add(id)
  }
}


// ── Form state ──
const form = reactive({
  name: '',
  displayName: '',
  url: '',
})

// Auto-derive URL from name
const urlDerived = ref(true)
watch(
  () => form.name,
  (name) => {
    if (urlDerived.value && name) {
      form.url = `https://${name}.nard.uk`
    }
  },
)

function onUrlInput() {
  urlDerived.value = false
}

// Validation
const nameValid = computed(() => /^[a-z0-9][a-z0-9-]*$/.test(form.name))
const formValid = computed(() => form.name && nameValid.value && form.displayName && form.url)

async function onProvision() {
  if (!formValid.value) return
  await provisionApp(form.name, form.displayName, form.url)
  form.name = ''
  form.displayName = ''
  form.url = ''
  urlDerived.value = true
}

// ── Status display helpers ──
const statusSteps = [
  'pending',
  'creating_repo',
  'dispatching',
  'cloning',
  'initializing',
  'deploying',
  'complete',
] as const

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    creating_repo: 'Creating Repo',
    dispatching: 'Dispatching Workflow',
    cloning: 'Cloning Template',
    initializing: 'Running Setup',
    deploying: 'Deploying',
    complete: 'Complete',
    failed: 'Failed',
  }
  return labels[status] || status
}

function statusColor(status: string): 'success' | 'error' | 'warning' | 'info' | 'primary' {
  if (status === 'complete') return 'success'
  if (status === 'failed') return 'error'
  return 'primary'
}

function statusProgress(status: string): number {
  const idx = statusSteps.indexOf(status as (typeof statusSteps)[number])
  if (idx === -1) return 0
  return Math.round((idx / (statusSteps.length - 1)) * 100)
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// ── Copy build command ──
function copyBuildCommand(job: ProvisionJob) {
  const repoPath = `~/new-code/template-apps/${job.appName}`
  const command = [
    `# Open this app in a new Antigravity window at ${repoPath}`,
    `# Then paste the following prompt:`,
    ``,
    `You are an expert Nuxt 4 + Cloudflare Workers developer. You've been dropped into a freshly provisioned repo.`,
    ``,
    `**App:** ${job.displayName} (${job.appName})`,
    `**URL:** ${job.appUrl}`,
    `**Repo:** ${job.githubRepo}`,
    `**Local Dev:** http://localhost:${job.nuxtPort ?? 3000}`,
    ``,
    `Run the /build-provisioned-app workflow to get started.`,
  ].join('\n')

  navigator.clipboard.writeText(command)
  toast.add({
    title: 'Copied to clipboard',
    description: `Build prompt for ${job.appName} copied. Open ${repoPath} in a new window and paste.`,
    color: 'success',
  })
}

// ── Clone command ──
function copyCloneCommand(job: ProvisionJob) {
  const cmd = `git clone https://github.com/${job.githubRepo}.git ~/new-code/template-apps/${job.appName} && cd ~/new-code/template-apps/${job.appName} && pnpm install`
  navigator.clipboard.writeText(cmd)
  toast.add({
    title: 'Clone command copied',
    description: `Run in terminal to clone ${job.appName}.`,
    color: 'success',
  })
}

const breadcrumbItems = computed(() => [
  { label: 'Dashboard', to: '/' },
  { label: 'Fleet', to: '/fleet' },
  { label: 'Provision' },
])
</script>

<template>
  <div>
    <AppBreadcrumbs :items="breadcrumbItems" />

    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="font-display text-2xl font-semibold text-default">Provision App</h1>
        <p class="mt-1 text-sm text-muted">
          Create a new fleet app from the template — GitHub repo, D1, Doppler, a dedicated local
          dev port, analytics, and first deploy.
        </p>
      </div>
      <UButton
        variant="outline"
        color="neutral"
        icon="i-lucide-refresh-cw"
        class="cursor-pointer"
        @click="refreshJobs()"
      >
        Refresh
      </UButton>
    </div>

    <!-- Provision Form -->
    <UCard class="mb-6">
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-rocket" class="size-5 text-primary" />
          <h2 class="font-semibold text-default">New App</h2>
        </div>
      </template>

      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField label="App Name" required hint="Lowercase kebab-case">
          <UInput
            v-model="form.name"
            placeholder="my-cool-app"
            class="w-full"
            :color="form.name && !nameValid ? 'error' : undefined"
          />
          <template #error>
            <span v-if="form.name && !nameValid" class="text-xs text-error">
              Must start with a letter/number, only lowercase + hyphens
            </span>
          </template>
        </UFormField>
        <UFormField label="Display Name" required>
          <UInput v-model="form.displayName" placeholder="My Cool App" class="w-full" />
        </UFormField>
        <UFormField label="Production URL" required>
          <UInput
            v-model="form.url"
            placeholder="https://my-cool-app.nard.uk"
            class="w-full"
            @input="onUrlInput"
          />
        </UFormField>
      </div>

      <template #footer>
        <div class="flex items-center justify-between">
          <p class="text-xs text-muted">
            This creates a GitHub repo, D1 database, Doppler project, unique NUXT_PORT, GA4
            property, and deploys the template.
          </p>
          <UButton
            icon="i-lucide-rocket"
            :loading="isProvisioning"
            :disabled="!formValid || isProvisioning"
            class="cursor-pointer"
            @click="onProvision"
          >
            Provision App
          </UButton>
        </div>
      </template>
    </UCard>

    <!-- Active Jobs -->
    <div v-if="activeJobs.length > 0" class="mb-6">
      <h2 class="mb-3 font-semibold text-default flex items-center gap-2">
        <span class="relative flex size-3">
          <span
            class="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75"
          />
          <span class="relative inline-flex size-3 rounded-full bg-primary" />
        </span>
        Active ({{ activeJobs.length }})
      </h2>
      <div class="grid gap-3">
        <UCard
          v-for="job in activeJobs"
          :key="job.id"
          class="border-primary/20 transition-all duration-300"
        >
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-semibold text-default">{{ job.displayName }}</h3>
                <p class="text-xs text-muted">{{ job.appName }} · {{ job.appUrl }}</p>
                <p v-if="job.nuxtPort" class="text-xs text-muted">
                  Local dev: http://localhost:{{ job.nuxtPort }}
                </p>
              </div>
              <UBadge :color="statusColor(job.status)" variant="subtle" class="shrink-0">
                {{ statusLabel(job.status) }}
              </UBadge>
            </div>
            <!-- Progress bar -->
            <div class="w-full rounded-full bg-elevated h-2">
              <div
                class="h-2 rounded-full bg-primary transition-all duration-500"
                :style="{ width: `${statusProgress(job.status)}%` }"
              />
            </div>
            <p class="text-xs text-muted">
              <ClientOnly>
                Started {{ relativeTime(job.createdAt) }} · Updated
                {{ relativeTime(job.updatedAt) }}
                <template #fallback><span class="opacity-0">loading</span></template>
              </ClientOnly>
            </p>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Completed / Failed Jobs -->
    <UCard v-if="jobs.length > 0">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-default">
            Provision History
            <UBadge variant="subtle" color="neutral" size="sm" class="ml-2 rounded-full px-2">
              {{ jobs.length }}
            </UBadge>
          </h2>
        </div>
      </template>

      <div class="divide-y divide-default">
        <div
          v-for="job in jobs"
          :key="job.id"
          class="flex flex-col border-b border-default last:border-0"
        >
          <div class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-medium text-default truncate">{{ job.displayName }}</h3>
                <UBadge :color="statusColor(job.status)" variant="subtle" size="xs">
                  {{ statusLabel(job.status) }}
                </UBadge>
              </div>
              <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                <span>{{ job.appName }}</span>
                <span v-if="job.nuxtPort">localhost:{{ job.nuxtPort }}</span>
                <span v-if="job.githubRepo" class="flex items-center gap-1">
                  <UIcon name="i-lucide-github" class="size-3" />
                  {{ job.githubRepo }}
                </span>
                <ClientOnly>
                  <span>{{ formatTime(job.createdAt) }}</span>
                  <template #fallback><span class="opacity-0">loading</span></template>
                </ClientOnly>
              </div>
              <p v-if="job.errorMessage" class="mt-1 text-xs text-error">
                {{ job.errorMessage }}
              </p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <template v-if="job.status === 'complete'">
                <UTooltip text="Copy clone command">
                  <UButton
                    icon="i-lucide-terminal"
                    size="xs"
                    variant="soft"
                    color="neutral"
                    class="cursor-pointer"
                    @click="copyCloneCommand(job)"
                  />
                </UTooltip>
                <UTooltip text="Copy build prompt for agent">
                  <UButton
                    icon="i-lucide-copy"
                    size="xs"
                    variant="soft"
                    color="primary"
                    class="cursor-pointer"
                    @click="copyBuildCommand(job)"
                  >
                    Copy Build Prompt
                  </UButton>
                </UTooltip>
                <UTooltip v-if="job.deployedUrl" text="Open deployed app">
                  <UButton
                    :to="job.deployedUrl || job.appUrl"
                    target="_blank"
                    icon="i-lucide-external-link"
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    class="cursor-pointer"
                  />
                </UTooltip>
              </template>
              <template v-if="job.status === 'failed'">
                <UTooltip text="Retry Job">
                  <UButton
                    icon="i-lucide-refresh-cw"
                    size="xs"
                    variant="soft"
                    color="warning"
                    class="cursor-pointer"
                    :loading="isProvisioning"
                    @click="retryJob(job.id)"
                  >
                    Retry
                  </UButton>
                </UTooltip>
                <UTooltip text="View in GitHub Actions">
                  <UButton
                    v-if="job.githubRepo"
                    :to="`https://github.com/${job.githubRepo}/actions`"
                    target="_blank"
                    icon="i-lucide-external-link"
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    class="cursor-pointer"
                  />
                </UTooltip>
              </template>
              <UTooltip :text="expandedJobs.has(job.id) ? 'Collapse logs' : 'View logs'">
                <UButton
                  :icon="expandedJobs.has(job.id) ? 'i-lucide-chevron-up' : 'i-lucide-log-out'"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  class="cursor-pointer"
                  @click="toggleJob(job.id)"
                />
              </UTooltip>
            </div>
          </div>
          
          <!-- Logs Expansion -->
          <div v-if="expandedJobs.has(job.id)">
            <div v-if="job.logs?.length" class="bg-elevated p-3 rounded-md mx-3 mb-4 mt-1 text-xs font-mono max-h-64 overflow-y-auto">
              <div v-for="log in job.logs" :key="log.id" class="flex items-start gap-2 py-1 border-b border-default last:border-0">
                <span class="text-muted shrink-0 w-16">{{ new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }}</span>
                <span
                  :class="{
                    'text-error': log.level === 'error',
                    'text-success': log.level === 'success',
                    'text-info': log.level === 'info',
                  }"
                >[{{ log.level.toUpperCase() }}]</span>
                <span v-if="log.step" class="text-primary">[{{ log.step }}]</span>
                <span class="text-default whitespace-pre-wrap">{{ log.message }}</span>
              </div>
            </div>
            <div v-else class="bg-elevated p-3 rounded-md mx-3 mb-4 mt-1 text-xs font-mono text-muted">
              No logs available for this job.
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Empty state -->
    <UCard v-if="jobs.length === 0">
      <div class="rounded-lg border border-dashed border-default p-8 text-center">
        <UIcon name="i-lucide-rocket" class="mx-auto size-10 text-muted" />
        <p class="mt-2 text-sm font-medium text-default">No provision jobs yet</p>
        <p class="mt-1 text-sm text-muted">
          Use the form above to provision your first app from the template.
        </p>
      </div>
    </UCard>
  </div>
</template>
