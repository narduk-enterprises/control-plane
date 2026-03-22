<script setup lang="ts">
import type { AuditResponse, AuditResult } from '~/types/audit'

useSeo({
  title: 'Fleet Audit',
  description: 'Audit fleet app runtime config, GA4 provider health, and Search Console access.',
})
useWebPageSchema({
  name: 'Narduk Control Plane — Fleet Audit',
  description:
    'Verify live runtime config plus GA4 and Search Console provider health across the fleet.',
})

const auditResponse = ref<AuditResponse | null>(null)
const isAuditing = ref(false)
const hasRun = ref(false)
const auditApi = useAuditApi()

const results = computed<AuditResult[]>(() => auditResponse.value?.results ?? [])
const reconcileSummary = computed(() => auditResponse.value?.reconcile ?? null)

async function runAudit(persist = false) {
  isAuditing.value = true
  hasRun.value = true
  try {
    auditResponse.value = await auditApi.runAudit(persist ? { persist: true } : undefined)
  } catch (err) {
    console.error('Audit failed:', err)
  } finally {
    isAuditing.value = false
  }
}

// Auto-load on mount
onMounted(() => {
  if (!hasRun.value) runAudit()
})

// Summary counts — derive from results directly
const allChecks = computed((): Array<{ status: string }> => {
  const out: Array<{ status: string }> = []
  for (const r of results.value) {
    if (r.fetchError) {
      out.push({ status: 'fail' })
    } else {
      for (const c of r.checks) out.push(c)
    }
  }
  return out
})
const passCount = computed(() => allChecks.value.filter((c) => c.status === 'pass').length)
const failCount = computed(() => allChecks.value.filter((c) => c.status === 'fail').length)
const warnCount = computed(() => allChecks.value.filter((c) => c.status === 'warning').length)
const skipCount = computed(() => allChecks.value.filter((c) => c.status === 'skipped').length)

// Apps that have at least one non-pass check
function hasIssue(app: AuditResult): boolean {
  if (app.fetchError) return true
  return app.checks.some((c) => c.status !== 'pass')
}

const appsWithIssues = computed(() => results.value.filter(hasIssue))
const allPassApps = computed(() => results.value.filter((a) => !hasIssue(a)))

const breadcrumbItems = computed(() => [{ label: 'Dashboard', to: '/' }, { label: 'Audit' }])
</script>

<template>
  <div>
    <AppBreadcrumbs :items="breadcrumbItems" />
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="font-display text-2xl font-semibold text-default">Fleet Audit</h1>
        <p class="mt-1 text-sm text-muted">
          Verify live runtime config plus GA4 and Search Console provider health across all fleet
          apps
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          icon="i-lucide-scan-search"
          :loading="isAuditing"
          :disabled="isAuditing"
          class="cursor-pointer"
          @click="runAudit()"
        >
          {{ isAuditing ? 'Auditing...' : 'Run Audit' }}
        </UButton>
        <UButton
          v-if="reconcileSummary?.candidates.length"
          variant="outline"
          color="neutral"
          icon="i-lucide-database-zap"
          :loading="isAuditing"
          :disabled="isAuditing"
          class="cursor-pointer"
          @click="runAudit(true)"
        >
          Reconcile GA IDs
        </UButton>
      </div>
    </div>

    <UAlert
      v-if="reconcileSummary"
      class="mb-6"
      icon="i-lucide-database-zap"
      :title="
        reconcileSummary.mode === 'write'
          ? 'Registry reconciled from live apps'
          : 'Dry-run reconcile preview'
      "
      :description="
        reconcileSummary.mode === 'write'
          ? `${reconcileSummary.updatedCount} measurement ID${reconcileSummary.updatedCount === 1 ? '' : 's'} updated in D1.`
          : `${reconcileSummary.candidates.length} live measurement ID${reconcileSummary.candidates.length === 1 ? '' : 's'} differ from the current registry.`
      "
      color="info"
      variant="subtle"
    />

    <!-- Summary cards -->
    <div v-if="hasRun && !isAuditing" class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
      <UCard class="text-center">
        <p class="text-2xl font-bold text-default">
          {{ results.length }}
        </p>
        <p class="mt-0.5 text-xs text-muted">Apps</p>
      </UCard>
      <UCard class="text-center">
        <p class="text-2xl font-bold text-success">
          {{ passCount }}
        </p>
        <p class="mt-0.5 text-xs text-muted">Passed</p>
      </UCard>
      <UCard class="text-center">
        <p class="text-2xl font-bold text-error">
          {{ failCount }}
        </p>
        <p class="mt-0.5 text-xs text-muted">Failed</p>
      </UCard>
      <UCard class="text-center">
        <p class="text-2xl font-bold text-warning">
          {{ warnCount }}
        </p>
        <p class="mt-0.5 text-xs text-muted">Warnings</p>
      </UCard>
      <UCard class="text-center">
        <p class="text-2xl font-bold text-muted">
          {{ skipCount }}
        </p>
        <p class="mt-0.5 text-xs text-muted">Skipped</p>
      </UCard>
    </div>

    <!-- Loading state -->
    <UCard v-if="isAuditing">
      <div class="flex flex-col items-center justify-center gap-4 py-12">
        <div
          class="size-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"
        />
        <div class="text-center">
          <p class="font-medium text-default">Auditing fleet apps…</p>
          <p class="mt-1 text-sm text-muted">
            Fetching and analysing all production sites in parallel
          </p>
        </div>
      </div>
    </UCard>

    <!-- Results — two sections -->
    <template v-else-if="hasRun && results.length > 0">
      <!-- Section 1: Apps with issues — expanded by default -->
      <div v-if="appsWithIssues.length > 0" class="mb-6">
        <div class="mb-3 flex items-center gap-2">
          <UIcon name="i-lucide-triangle-alert" class="size-4 text-warning" />
          <h2 class="font-semibold text-default">
            Issues ({{ appsWithIssues.length }}
            <span class="font-normal text-muted"
              >app{{ appsWithIssues.length === 1 ? '' : 's' }}</span
            >)
          </h2>
        </div>
        <AuditAppList
          :apps="appsWithIssues"
          :default-expanded="true"
          empty-message="No apps with issues."
        />
      </div>

      <!-- Divider + all-clear if nothing has issues -->
      <UCard v-else class="mb-6">
        <div class="flex items-center justify-center gap-3 py-4 text-success">
          <UIcon name="i-lucide-shield-check" class="size-6" />
          <p class="font-semibold">All apps passed every check</p>
        </div>
      </UCard>

      <!-- Section 2: All apps — collapsed -->
      <div>
        <div class="mb-3 flex items-center gap-2">
          <UIcon name="i-lucide-layers" class="size-4 text-muted" />
          <h2 class="font-semibold text-default">All Apps ({{ results.length }})</h2>
          <p v-if="allPassApps.length > 0" class="text-xs text-muted">
            — {{ allPassApps.length }} fully passing
          </p>
        </div>
        <AuditAppList
          :apps="results"
          :default-expanded="false"
          empty-message="No apps in fleet registry."
        />
      </div>
    </template>

    <!-- Empty / no-run state -->
    <UCard v-else-if="!hasRun">
      <div class="rounded-lg border border-dashed border-default bg-elevated/50 p-12 text-center">
        <UIcon name="i-lucide-shield-check" class="mx-auto mb-4 size-14 text-muted/40" />
        <p class="text-base font-medium text-default">Fleet Configuration Audit</p>
        <p class="mx-auto mt-2 max-w-md text-sm text-muted">
          Click "Run Audit" to fetch each app&apos;s production HTML and compare it with the
          canonical GA4 and Search Console provider health snapshot for the fleet.
        </p>
      </div>
    </UCard>

    <!-- Ran but no results -->
    <UCard v-else>
      <div class="rounded-lg border border-dashed border-default p-8 text-center">
        <UIcon name="i-lucide-inbox" class="mx-auto size-10 text-muted" />
        <p class="mt-2 text-sm font-medium text-default">No audit results</p>
        <p class="mt-1 text-sm text-muted">
          The audit completed but produced no results. Ensure fleet apps are registered.
        </p>
      </div>
    </UCard>
  </div>
</template>
