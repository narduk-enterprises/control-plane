<script setup lang="ts">
import type { FleetD1BindingRefs } from '~/composables/useFleetD1Console'

const route = useRoute()
const appName = computed(() => String(route.params.app ?? ''))

const toast = useToast()
const { rawApps } = useFleet({ includeInactive: true })
const appRecord = computed(() => rawApps.value.find((app) => app.name === appName.value) ?? null)

const databaseName = ref('')
const databaseId = ref('')
const showAdvanced = ref(false)
const binding: FleetD1BindingRefs = { databaseName, databaseId, showAdvanced }

const studio = useFleetD1StudioBrowse(appName, binding)

const {
  sql,
  loading,
  mutationPending,
  errorMessage,
  lastResponse,
  canRun,
  run,
  runParameterizedMutation,
  clearResults,
} = useFleetD1Console(appName, binding)

const defaultDbHint = computed(() => `${appName.value}-db`)
const mainTab = ref<'browse' | 'sql'>('browse')

useSeo({
  robots: 'noindex',
  title: `${appName.value} — D1`,
  description: `Browse and query ${appName.value} production D1.`,
})
useWebPageSchema({
  name: 'Fleet app D1',
  description: 'Remote D1 studio and SQL console.',
})

const breadcrumbItems = computed(() => [
  { label: 'Dashboard', to: '/' },
  { label: 'Fleet', to: '/fleet' },
  { label: appName.value, to: `/fleet/${appName.value}` },
  { label: 'D1' },
])

async function handleRun() {
  await run()
  if (lastResponse.value) {
    toast.add({
      title: 'Query finished',
      description: `Target: ${lastResponse.value.databaseName}`,
      color: 'success',
    })
  } else if (errorMessage.value) {
    toast.add({
      title: 'Query failed',
      description: errorMessage.value,
      color: 'error',
    })
  }
}

async function runGridWrite(op: { sql: string; params: string[] }) {
  await runParameterizedMutation(op)
  toast.add({ title: 'D1 updated', color: 'success' })
}

async function onStudioDataMutated() {
  await studio.loadTables()
  await studio.loadGrid()
}
</script>

<template>
  <div class="space-y-6">
    <AppBreadcrumbs :items="breadcrumbItems" />

    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 class="font-display text-2xl font-semibold text-default">D1</h1>
        <p class="mt-1 text-sm text-muted">
          {{ appName }} — remote production database (default
          <code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-xs">{{ defaultDbHint }}</code
          >). Drizzle Studio only talks to local DB files; this UI uses Cloudflare’s HTTP API instead.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          :to="`/fleet/${appName}`"
          variant="outline"
          color="neutral"
          icon="i-lucide-arrow-left"
          class="cursor-pointer"
        >
          Back to app
        </UButton>
        <UButton
          :to="`/analytics/${appName}`"
          variant="outline"
          color="neutral"
          icon="i-lucide-chart-column-big"
          class="cursor-pointer"
        >
          Analytics
        </UButton>
      </div>
    </div>

    <UAlert
      v-if="!appRecord"
      color="warning"
      variant="subtle"
      icon="i-lucide-alert-triangle"
      title="Unknown fleet app"
      description="This name is not in the fleet registry. The API will reject requests until the app is registered."
    />

    <UCard>
      <template #header>
        <h2 class="text-sm font-medium text-default">Connection</h2>
      </template>
      <div class="space-y-3">
        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          class="cursor-pointer -ml-2"
          :icon="showAdvanced ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          @click="showAdvanced = !showAdvanced"
        >
          {{ showAdvanced ? 'Hide' : 'Show' }} advanced (database name / UUID)
        </UButton>
        <div v-if="showAdvanced" class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Database name (optional)"
            :help="`Leave empty to use ${defaultDbHint}`"
          >
            <UInput v-model="databaseName" class="w-full font-mono text-sm" placeholder="my-app-db" />
          </UFormField>
          <UFormField
            label="Database UUID (optional)"
            help="Skips name lookup when set. Must match the app’s D1."
          >
            <UInput
              v-model="databaseId"
              class="w-full font-mono text-sm"
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </UFormField>
        </div>
      </div>
    </UCard>

    <div class="flex flex-wrap gap-1 border-b border-default/15 pb-1">
      <UButton
        :color="mainTab === 'browse' ? 'primary' : 'neutral'"
        :variant="mainTab === 'browse' ? 'solid' : 'ghost'"
        size="sm"
        icon="i-lucide-table-properties"
        class="cursor-pointer"
        @click="mainTab = 'browse'"
      >
        Browse tables
      </UButton>
      <UButton
        :color="mainTab === 'sql' ? 'primary' : 'neutral'"
        :variant="mainTab === 'sql' ? 'solid' : 'ghost'"
        size="sm"
        icon="i-lucide-terminal"
        class="cursor-pointer"
        @click="mainTab = 'sql'"
      >
        SQL console
      </UButton>
    </div>

    <template v-if="mainTab === 'browse'">
      <UAlert
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        title="Studio-style grid"
        description="Page through rows, insert new ones, and edit or delete by primary key. Tables without a PK can still be inserted into; use the SQL tab for bulk or complex changes. Drizzle Studio cannot target remote D1; this uses Cloudflare’s HTTP API."
        class="mb-2"
      />
      <FleetD1StudioPanel
        :app-name="appName"
        :tables="studio.tablesData?.tables ?? []"
        :tables-hint="studio.tablesData?.hint"
        :catalog-table-count="studio.tablesData?.catalogTableCount"
        :internal-table-count="studio.tablesData?.internalTableCount"
        :tables-pending="studio.tablesPending"
        :tables-error="studio.tablesError"
        :selected-table="studio.selectedTable"
        :grid-data="studio.gridData"
        :grid-pending="studio.gridPending"
        :grid-error="studio.gridError"
        :page="studio.page"
        :page-size="studio.pageSize"
        :total-pages="studio.totalPages"
        :write-pending="mutationPending"
        :run-write="runGridWrite"
        @select-table="studio.selectTable"
        @update:page="(p) => (studio.page = p)"
        @update:page-size="(n) => (studio.pageSize = n)"
        @refresh="studio.loadTables()"
        @data-mutated="onStudioDataMutated"
      />
    </template>

    <template v-else>
      <UAlert
        color="warning"
        variant="subtle"
        icon="i-lucide-database-zap"
        title="Production read/write"
        description="SQL runs against live D1. DDL, DML, and DELETE are allowed. There is no undo."
      />

      <UCard>
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-sm font-medium text-default">SQL</h2>
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              icon="i-lucide-eraser"
              class="cursor-pointer"
              @click="clearResults"
            >
              Clear results
            </UButton>
          </div>
        </template>

        <div class="space-y-4">
          <UFormField
            label="Statements"
            :help="`Runs as one batch; use semicolons between statements.`"
          >
            <UTextarea v-model="sql" :rows="16" autoresize class="w-full font-mono text-sm" />
          </UFormField>

          <div class="flex flex-wrap gap-2">
            <UButton
              color="primary"
              icon="i-lucide-play"
              class="cursor-pointer"
              :loading="loading"
              :disabled="!canRun || !appRecord"
              @click="handleRun"
            >
              Run on remote D1
            </UButton>
          </div>

          <UAlert
            v-if="errorMessage"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="errorMessage"
          />
        </div>
      </UCard>

      <template v-if="lastResponse">
        <div class="flex flex-wrap items-center gap-2 text-sm text-muted">
          <UIcon name="i-lucide-server" class="size-4" />
          <span
            >Resolved
            <span class="font-mono text-default">{{ lastResponse.databaseName }}</span>
            ({{ lastResponse.databaseId }})</span
          >
        </div>

        <div class="space-y-4">
          <FleetD1StatementResult
            v-for="(batch, idx) in lastResponse.result"
            :key="idx"
            :index="idx"
            :batch="batch"
          />
        </div>
      </template>
    </template>
  </div>
</template>
