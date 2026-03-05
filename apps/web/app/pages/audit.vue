<script setup lang="ts">
import { h } from 'vue'
import type { AuditResult } from '~/types/audit'
import type { TableColumn } from '~/types/table'

useSeo({
  title: 'Fleet Audit',
  description: 'Audit fleet app configurations — PostHog, GA, APP_NAME verification.',
})
useWebPageSchema({
  name: 'Narduk Control Plane — Fleet Audit',
  description: 'Verify analytics and app configuration across the fleet.',
})

const results = ref<AuditResult[]>([])
const isAuditing = ref(false)
const hasRun = ref(false)
const auditApi = useAuditApi()

async function runAudit() {
  isAuditing.value = true
  hasRun.value = true
  try {
    results.value = await auditApi.runAudit()
  }
  catch (err) {
    console.error('Audit failed:', err)
  }
  finally {
    isAuditing.value = false
  }
}

// Flatten results for the table
interface FlatCheck {
  app: string
  url: string
  checkName: string
  status: 'pass' | 'fail' | 'warning' | 'skipped'
  expected: string | null
  actual: string | null
  message: string
  fetchError?: string
}

const flatChecks = computed<FlatCheck[]>(() => {
  const rows: FlatCheck[] = []
  for (const r of results.value) {
    if (r.fetchError) {
      rows.push({
        app: r.app,
        url: r.url,
        checkName: 'Fetch',
        status: 'fail',
        expected: null,
        actual: null,
        message: r.fetchError,
        fetchError: r.fetchError,
      })
      continue
    }
    for (const c of r.checks) {
      rows.push({
        app: r.app,
        url: r.url,
        checkName: c.name,
        status: c.status,
        expected: c.expected,
        actual: c.actual,
        message: c.message,
      })
    }
  }
  return rows
})

// Summary counts
const passCount = computed(() => flatChecks.value.filter(c => c.status === 'pass').length)
const failCount = computed(() => flatChecks.value.filter(c => c.status === 'fail').length)
const warnCount = computed(() => flatChecks.value.filter(c => c.status === 'warning').length)
const skipCount = computed(() => flatChecks.value.filter(c => c.status === 'skipped').length)
const appCount = computed(() => results.value.length)

function statusColor(status: string): string {
  switch (status) {
    case 'pass': return 'text-success'
    case 'fail': return 'text-error'
    case 'warning': return 'text-warning'
    default: return 'text-muted'
  }
}

function statusIcon(status: string): string {
  switch (status) {
    case 'pass': return 'i-lucide-circle-check'
    case 'fail': return 'i-lucide-circle-x'
    case 'warning': return 'i-lucide-triangle-alert'
    default: return 'i-lucide-circle-minus'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'pass': return 'Pass'
    case 'fail': return 'Fail'
    case 'warning': return 'Warn'
    default: return 'Skip'
  }
}

// Filtering
const filterStatus = ref<string>('all')
const searchQuery = ref('')

const filteredChecks = computed(() => {
  let rows = flatChecks.value
  if (filterStatus.value !== 'all') {
    rows = rows.filter(r => r.status === filterStatus.value)
  }
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    rows = rows.filter(r =>
      r.app.toLowerCase().includes(q) ||
      r.checkName.toLowerCase().includes(q) ||
      r.message.toLowerCase().includes(q),
    )
  }
  return rows
})

const columns: TableColumn<FlatCheck>[] = [
  {
    accessorKey: 'app',
    header: 'App',
    cell: ({ row }) => h('span', { class: 'font-medium text-default' }, row.original.app),
  },
  {
    accessorKey: 'checkName',
    header: 'Check',
    cell: ({ row }) => h('span', { class: 'text-sm' }, row.original.checkName),
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const s = row.original.status
      return h('div', { class: `flex items-center gap-1.5 font-medium text-sm ${statusColor(s)}` }, [
        h('span', { class: `${statusIcon(s)} size-4` }),
        statusLabel(s),
      ])
    },
  },
  {
    id: 'expected',
    header: 'Expected',
    meta: { class: { th: 'hidden lg:table-cell', td: 'hidden lg:table-cell max-w-[180px] truncate' } },
    cell: ({ row }) => h('span', { class: 'text-xs text-muted font-mono' }, row.original.expected ?? '—'),
  },
  {
    id: 'actual',
    header: 'Actual',
    meta: { class: { th: 'hidden lg:table-cell', td: 'hidden lg:table-cell max-w-[180px] truncate' } },
    cell: ({ row }) => h('span', { class: 'text-xs text-muted font-mono' }, row.original.actual ?? '—'),
  },
  {
    id: 'message',
    header: 'Details',
    meta: { class: { td: 'max-w-[300px] text-wrap' } },
    cell: ({ row }) => h('span', { class: 'text-xs text-muted' }, row.original.message),
  },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- UTable expects @nuxt/ui TableColumn, not our local type
const columnsForTable = columns as any

const breadcrumbItems = computed(() => [
  { label: 'Dashboard', to: '/' },
  { label: 'Audit' },
])
</script>

<template>
  <div>
    <AppBreadcrumbs :items="breadcrumbItems" />
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="font-display text-2xl font-semibold text-default">
          Fleet Audit
        </h1>
        <p class="mt-1 text-sm text-muted">
          Verify PostHog, Google Analytics, and APP_NAME configuration across all fleet apps
        </p>
      </div>
      <UButton
        icon="i-lucide-scan-search"
        :loading="isAuditing"
        :disabled="isAuditing"
        class="cursor-pointer"
        @click="runAudit()"
      >
        {{ isAuditing ? 'Auditing...' : 'Run Audit' }}
      </UButton>
    </div>

    <!-- Summary cards -->
    <div v-if="hasRun && !isAuditing" class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
      <UCard class="text-center">
        <p class="text-2xl font-bold text-default">
          {{ appCount }}
        </p>
        <p class="text-xs text-muted mt-0.5">
          Apps
        </p>
      </UCard>
      <UCard class="text-center">
        <p class="text-2xl font-bold text-success">
          {{ passCount }}
        </p>
        <p class="text-xs text-muted mt-0.5">
          Passed
        </p>
      </UCard>
      <UCard class="text-center">
        <p class="text-2xl font-bold text-error">
          {{ failCount }}
        </p>
        <p class="text-xs text-muted mt-0.5">
          Failed
        </p>
      </UCard>
      <UCard class="text-center">
        <p class="text-2xl font-bold text-warning">
          {{ warnCount }}
        </p>
        <p class="text-xs text-muted mt-0.5">
          Warnings
        </p>
      </UCard>
      <UCard class="text-center">
        <p class="text-2xl font-bold text-muted">
          {{ skipCount }}
        </p>
        <p class="text-xs text-muted mt-0.5">
          Skipped
        </p>
      </UCard>
    </div>

    <!-- Loading state -->
    <UCard v-if="isAuditing">
      <div class="flex flex-col items-center justify-center gap-4 py-12">
        <div class="relative">
          <div class="size-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        </div>
        <div class="text-center">
          <p class="font-medium text-default">
            Auditing fleet apps...
          </p>
          <p class="mt-1 text-sm text-muted">
            Fetching and analysing HTML from each production site
          </p>
        </div>
      </div>
    </UCard>

    <!-- Results table -->
    <UCard v-else-if="hasRun && flatChecks.length > 0">
      <template #header>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 class="font-semibold text-default">
            Audit Results
          </h2>
          <div class="flex items-center gap-2">
            <USelect
              v-model="filterStatus"
              :items="[
                { label: 'All Statuses', value: 'all' },
                { label: 'Pass', value: 'pass' },
                { label: 'Fail', value: 'fail' },
                { label: 'Warning', value: 'warning' },
                { label: 'Skipped', value: 'skipped' },
              ]"
              class="w-36"
            />
            <UInput
              v-model="searchQuery"
              placeholder="Filter by app or check..."
              class="max-w-xs"
              icon="i-lucide-search"
            >
              <template #trailing>
                <UButton
                  v-show="searchQuery !== ''"
                  color="neutral"
                  variant="link"
                  size="xs"
                  icon="i-lucide-x"
                  aria-label="Clear search"
                  class="cursor-pointer px-1"
                  @click="searchQuery = ''"
                />
              </template>
            </UInput>
          </div>
        </div>
      </template>
      <div class="overflow-x-auto">
        <UTable
          :data="filteredChecks"
          :columns="columnsForTable"
        />
      </div>
    </UCard>

    <!-- Empty / no-run state -->
    <UCard v-else-if="!hasRun">
      <div class="rounded-lg border border-dashed border-default p-12 text-center bg-elevated/50">
        <UIcon name="i-lucide-shield-check" class="mx-auto size-14 text-muted/40 mb-4" />
        <p class="text-base font-medium text-default">
          Fleet Configuration Audit
        </p>
        <p class="mt-2 text-sm text-muted max-w-md mx-auto">
          Click "Run Audit" to fetch each app's production HTML and verify that PostHog, Google Analytics, and APP_NAME configurations match the fleet registry.
        </p>
      </div>
    </UCard>

    <!-- Ran but no results -->
    <UCard v-else>
      <div class="rounded-lg border border-dashed border-default p-8 text-center">
        <UIcon name="i-lucide-inbox" class="mx-auto size-10 text-muted" />
        <p class="mt-2 text-sm font-medium text-default">
          No audit results
        </p>
        <p class="mt-1 text-sm text-muted">
          The audit completed but produced no results. Ensure fleet apps are registered.
        </p>
      </div>
    </UCard>
  </div>
</template>
