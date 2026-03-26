<script setup lang="ts">
import type {
  FleetDatabaseBackend,
  FleetDatabaseColumnInfo,
  FleetDatabaseTableGridResponse,
} from '~/types/fleet'
import { UButton } from '#components'
import { quoteSqlIdent, quoteTableRef, sqlPlaceholder } from '~/utils/fleet-database-sql'

const props = defineProps<{
  backend: FleetDatabaseBackend
  appName: string
  schemaName?: string | null
  tables: string[]
  /** From GET /d1/tables — explains empty sidebar (e.g. only _cf_* internal tables). */
  tablesHint?: string
  catalogTableCount?: number
  internalTableCount?: number
  tablesPending: boolean
  tablesError: string
  selectedTable: string | null
  gridData: FleetDatabaseTableGridResponse | null
  gridPending: boolean
  gridError: string
  page: number
  pageSize: number
  totalPages: number
  writePending: boolean
  runWrite: (op: {
    sql: string
    params: Array<string | number | boolean | null>
  }) => Promise<void>
}>()

const emit = defineEmits<{
  selectTable: [name: string]
  'update:page': [page: number]
  'update:pageSize': [size: number]
  refresh: []
  'data-mutated': []
}>()

const toast = useToast()

const editOpen = ref(false)
const deleteOpen = ref(false)
const insertOpen = ref(false)
const editingRow = ref<Record<string, unknown> | null>(null)
const deleteTarget = ref<Record<string, unknown> | null>(null)
const draftRecord = ref<Record<string, string>>({})
const insertDraft = ref<Record<string, string>>({})

const hasPk = computed(() => (props.gridData?.columns ?? []).some((c) => c.pk))
const fallbackSchemaName = computed(() => props.gridData?.schemaName || props.schemaName || 'public')

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function cellToDraft(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function openEdit(row: Record<string, unknown>) {
  const g = props.gridData
  if (!g || !hasPk.value) return
  editingRow.value = row
  const d: Record<string, string> = {}
  for (const c of g.columns) {
    d[c.name] = cellToDraft(row[c.name])
  }
  draftRecord.value = d
  editOpen.value = true
}

function openDelete(row: Record<string, unknown>) {
  if (!hasPk.value) return
  deleteTarget.value = row
  deleteOpen.value = true
}

function openInsert() {
  const g = props.gridData
  if (!g || !props.selectedTable) return
  const d: Record<string, string> = {}
  for (const c of g.columns) {
    d[c.name] = ''
  }
  insertDraft.value = d
  insertOpen.value = true
}

async function saveEdit() {
  const g = props.gridData
  const table = props.selectedTable
  const orig = editingRow.value
  if (!g || !table || !orig) return

  const tableIdent = quoteTableRef(props.backend, table, fallbackSchemaName.value)
  const pkCols = g.columns.filter((c) => c.pk)
  const nonPk = g.columns.filter((c) => !c.pk)
  const sets: string[] = []
  const params: Array<string | number | boolean | null> = []

  for (const col of nonPk) {
    const newV = draftRecord.value[col.name] ?? ''
    const oldStr = cellToDraft(orig[col.name])
    if (newV === oldStr) continue
    if (newV === '' && col.notnull === 0) {
      sets.push(`${quoteSqlIdent(col.name)} = NULL`)
    } else {
      sets.push(`${quoteSqlIdent(col.name)} = ${sqlPlaceholder(props.backend, params.length + 1)}`)
      params.push(newV)
    }
  }

  if (sets.length === 0) {
    editOpen.value = false
    return
  }

  const whereParts: string[] = []
  for (const col of pkCols) {
    whereParts.push(`${quoteSqlIdent(col.name)} = ${sqlPlaceholder(props.backend, params.length + 1)}`)
    params.push(coerceParam(orig[col.name]))
  }

  const sql = `UPDATE ${tableIdent} SET ${sets.join(', ')} WHERE ${whereParts.join(' AND ')}`

  try {
    await props.runWrite({ sql, params })
    editOpen.value = false
    emit('data-mutated')
  } catch (err) {
    const e = err as { data?: { message?: string }; message?: string }
    toast.add({
      title: 'Update failed',
      description: e.data?.message || e.message || 'Request failed',
      color: 'error',
    })
  }
}

function coerceParam(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' || typeof v === 'boolean') return v
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

async function confirmDelete() {
  const g = props.gridData
  const table = props.selectedTable
  const row = deleteTarget.value
  if (!g || !table || !row) return

  const tableIdent = quoteTableRef(props.backend, table, fallbackSchemaName.value)
  const pkCols = g.columns.filter((c) => c.pk)
  const whereParts: string[] = []
  const params: Array<string | number | boolean | null> = []
  for (const col of pkCols) {
    whereParts.push(`${quoteSqlIdent(col.name)} = ${sqlPlaceholder(props.backend, params.length + 1)}`)
    params.push(coerceParam(row[col.name]))
  }
  const sql = `DELETE FROM ${tableIdent} WHERE ${whereParts.join(' AND ')}`

  try {
    await props.runWrite({ sql, params })
    deleteOpen.value = false
    deleteTarget.value = null
    emit('data-mutated')
  } catch (err) {
    const e = err as { data?: { message?: string }; message?: string }
    toast.add({
      title: 'Delete failed',
      description: e.data?.message || e.message || 'Request failed',
      color: 'error',
    })
  }
}

async function saveInsert() {
  const g = props.gridData
  const table = props.selectedTable
  if (!g || !table) return

  for (const col of g.columns) {
    const v = insertDraft.value[col.name] ?? ''
    const hasDefault =
      col.dflt_value !== null && col.dflt_value !== undefined && String(col.dflt_value).trim() !== ''
    if (v === '' && col.notnull !== 0 && !hasDefault && col.pk === 0) {
      toast.add({
        title: 'Missing value',
        description: `Column "${col.name}" is required (NOT NULL).`,
        color: 'warning',
      })
      return
    }
  }

  const tableIdent = quoteTableRef(props.backend, table, fallbackSchemaName.value)
  const colIdents: string[] = []
  const valueParts: string[] = []
  const params: Array<string | number | boolean | null> = []

  for (const col of g.columns) {
    const v = insertDraft.value[col.name] ?? ''
    const hasDefault =
      col.dflt_value !== null && col.dflt_value !== undefined && String(col.dflt_value).trim() !== ''

    if (v === '' && (col.notnull === 0 || hasDefault || col.pk > 0)) {
      continue
    }

    colIdents.push(quoteSqlIdent(col.name))
    valueParts.push(sqlPlaceholder(props.backend, params.length + 1))
    params.push(v)
  }

  const sql =
    colIdents.length > 0
      ? `INSERT INTO ${tableIdent} (${colIdents.join(', ')}) VALUES (${valueParts.join(', ')})`
      : `INSERT INTO ${tableIdent} DEFAULT VALUES`

  try {
    await props.runWrite({ sql, params })
    insertOpen.value = false
    emit('data-mutated')
  } catch (err) {
    const e = err as { data?: { message?: string }; message?: string }
    toast.add({
      title: 'Insert failed',
      description: e.data?.message || e.message || 'Request failed',
      color: 'error',
    })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic grid columns from remote schema
const gridColumns = computed<any[]>(() => {
  const g = props.gridData
  if (!g?.columns?.length) return []

  const actionsCol = {
    id: 'actions',
    accessorKey: '__actions',
    header: '',
    meta: {
      class: {
        th: 'w-[1%]',
        td: 'w-[1%] whitespace-nowrap align-top',
      },
    },
    cell: ({ row }: { row: { original: Record<string, unknown> } }) =>
      h('div', { class: 'flex gap-0.5' }, [
        h(UButton, {
          size: 'xs',
          variant: 'ghost',
          color: 'neutral',
          icon: 'i-lucide-pencil',
          class: 'cursor-pointer',
          disabled: !hasPk.value || props.writePending,
          title: hasPk.value ? 'Edit row' : 'Primary key required',
          onClick: () => openEdit(row.original),
        }),
        h(UButton, {
          size: 'xs',
          variant: 'ghost',
          color: 'error',
          icon: 'i-lucide-trash-2',
          class: 'cursor-pointer',
          disabled: !hasPk.value || props.writePending,
          title: hasPk.value ? 'Delete row' : 'Primary key required',
          onClick: () => openDelete(row.original),
        }),
      ]),
  }

  const dataCols = g.columns.map((c: FleetDatabaseColumnInfo) => ({
    accessorKey: c.name,
    header: c.pk ? `★ ${c.name}` : c.name,
    meta: {
      class: {
        th: 'text-xs font-medium',
        td: 'max-w-[220px] whitespace-normal break-words align-top font-mono text-[11px]',
      },
    },
    cell: ({ row }: { row: { original: Record<string, unknown> } }) =>
      formatCell(row.original[c.name]),
  }))

  return [actionsCol, ...dataCols]
})

const pageSizeOptions = [
  { label: '25 rows', value: 25 },
  { label: '50 rows', value: 50 },
  { label: '100 rows', value: 100 },
  { label: '200 rows', value: 200 },
]

function onPageSizeChange(value: unknown) {
  emit('update:pageSize', Number(value))
}
</script>

<template>
  <div class="flex flex-col gap-4 lg:flex-row lg:items-stretch">
    <UCard class="w-full shrink-0 lg:w-56 xl:w-64">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-sm font-medium text-default">Tables</h2>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-refresh-cw"
            class="cursor-pointer shrink-0"
            :loading="tablesPending"
            @click="emit('refresh')"
          />
        </div>
      </template>

      <UAlert v-if="tablesError" color="error" variant="subtle" class="mb-3" :title="tablesError" />

      <UAlert
        v-else-if="tablesHint"
        color="warning"
        variant="subtle"
        icon="i-lucide-database"
        class="mb-3"
        title="No browsable tables"
        :description="tablesHint"
      />

      <p v-if="!tablesPending && (catalogTableCount ?? 0) > 0" class="mb-2 text-xs text-muted">
        Catalog: {{ catalogTableCount }} object(s)
        <template v-if="backend === 'd1' && (internalTableCount ?? 0) > 0">
          · {{ internalTableCount }} internal/system hidden (sqlite_*, _cf_*)
        </template>
      </p>

      <div v-if="tablesPending && !tables.length" class="py-6 text-center text-sm text-muted">
        Loading…
      </div>
      <div
        v-else-if="!tables.length && !tablesHint"
        class="py-6 space-y-2 text-center text-sm text-muted"
      >
        <p>No tables returned.</p>
        <p class="text-xs">
          If you expect data here, confirm this app’s live database is reachable from the control
          plane and has migrations applied.
        </p>
      </div>
      <ul v-else class="max-h-[min(28rem,50vh)] space-y-0.5 overflow-y-auto pr-1">
        <li v-for="t in tables" :key="t">
          <UButton
            :color="selectedTable === t ? 'primary' : 'neutral'"
            :variant="selectedTable === t ? 'soft' : 'ghost'"
            size="sm"
            class="w-full cursor-pointer justify-start font-mono text-xs"
            @click="emit('selectTable', t)"
          >
            {{ t }}
          </UButton>
        </li>
      </ul>
    </UCard>

    <UCard class="min-w-0 flex-1 overflow-hidden">
      <template #header>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 class="text-sm font-medium text-default">
            <span v-if="selectedTable" class="font-mono">{{ selectedTable }}</span>
            <span v-else class="text-muted">Select a table</span>
          </h2>
          <div v-if="gridData" class="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{{ gridData.total.toLocaleString() }} row(s)</span>
            <span class="hidden sm:inline">·</span>
            <span class="font-mono">{{ gridData.databaseName }}</span>
            <template v-if="backend === 'postgres' && gridData.schemaName">
              <span class="hidden sm:inline">·</span>
              <span class="font-mono">{{ gridData.schemaName }}</span>
            </template>
          </div>
        </div>
      </template>

      <UAlert v-if="gridError" color="error" variant="subtle" class="mb-4" :title="gridError" />

      <UAlert
        v-if="gridData && !hasPk"
        color="warning"
        variant="subtle"
        icon="i-lucide-key-round"
        class="mb-4"
        title="No primary key on this table"
        description="Row edit/delete needs a primary key. You can still insert rows and use the SQL tab for arbitrary updates."
      />

      <div
        v-if="!selectedTable"
        class="rounded-lg border border-dashed border-default/25 py-16 text-center text-sm text-muted"
      >
        Choose a table on the left. Edit or delete rows from the grid (when a primary key exists),
        or insert a row with the button above the table.
      </div>

      <template v-else>
        <div v-if="gridPending" class="py-12 text-center text-sm text-muted">Loading rows…</div>
        <template v-else-if="gridData">
          <div
            class="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          >
            <div class="flex flex-wrap items-center gap-2">
              <UButton
                size="sm"
                variant="outline"
                color="neutral"
                icon="i-lucide-plus"
                class="cursor-pointer"
                :disabled="writePending"
                @click="openInsert"
              >
                Insert row
              </UButton>
              <span class="text-xs text-muted">Page size</span>
              <USelect
                :model-value="pageSize"
                :items="pageSizeOptions"
                value-attribute="value"
                class="w-40"
                size="sm"
                @update:model-value="onPageSizeChange"
              />
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <UButton
                size="sm"
                variant="outline"
                color="neutral"
                icon="i-lucide-chevron-left"
                class="cursor-pointer"
                :disabled="page <= 1"
                @click="emit('update:page', page - 1)"
              />
              <span class="min-w-[8rem] text-center text-xs text-muted">
                Page {{ page }} / {{ totalPages }}
              </span>
              <UButton
                size="sm"
                variant="outline"
                color="neutral"
                icon="i-lucide-chevron-right"
                class="cursor-pointer"
                :disabled="page >= totalPages"
                @click="emit('update:page', page + 1)"
              />
            </div>
          </div>

          <div class="overflow-x-auto rounded-lg border border-default/10">
            <!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
            <UTable
              v-if="gridColumns.length && gridData.rows.length"
              :data="gridData.rows"
              :columns="gridColumns as any"
              class="min-w-max text-xs"
            />
            <p v-else class="p-6 text-center text-sm text-muted">No rows in this page range.</p>
          </div>
        </template>
      </template>
    </UCard>

    <UModal v-model:open="editOpen">
      <template #header>
        <h3 class="font-semibold text-default">Edit row</h3>
      </template>
      <template #body>
        <div v-if="gridData" class="max-h-[min(24rem,60vh)] space-y-3 overflow-y-auto">
          <UFormField
            v-for="col in gridData.columns"
            :key="col.name"
            :label="col.name + (col.pk ? ' (PK)' : '') + (col.type ? ` — ${col.type}` : '')"
          >
            <UInput
              v-model="draftRecord[col.name]"
              class="w-full font-mono text-sm"
              :disabled="Boolean(col.pk)"
            />
          </UFormField>
          <p v-if="gridData.columns.some((c) => c.pk)" class="text-xs text-muted">
            Primary key columns cannot be changed here; delete and re-insert if needed.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            variant="outline"
            color="neutral"
            class="cursor-pointer"
            @click="editOpen = false"
          >
            Cancel
          </UButton>
          <UButton color="primary" class="cursor-pointer" :loading="writePending" @click="saveEdit">
            Save
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="deleteOpen">
      <template #header>
        <h3 class="font-semibold text-default">Delete row</h3>
      </template>
      <template #body>
        <p class="text-sm text-default">
          This permanently removes the row from the live database.
        </p>
        <pre
          v-if="deleteTarget && gridData"
          class="card-base mt-3 max-h-40 overflow-auto rounded-lg p-3 text-xs font-mono text-muted"
          >{{ JSON.stringify(deleteTarget, null, 2) }}</pre
        >
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            variant="outline"
            color="neutral"
            class="cursor-pointer"
            @click="deleteOpen = false"
          >
            Cancel
          </UButton>
          <UButton
            color="error"
            class="cursor-pointer"
            :loading="writePending"
            @click="confirmDelete"
          >
            Delete
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="insertOpen">
      <template #header>
        <h3 class="font-semibold text-default">Insert row</h3>
      </template>
      <template #body>
        <div v-if="gridData" class="max-h-[min(24rem,60vh)] space-y-3 overflow-y-auto">
          <UFormField
            v-for="col in gridData.columns"
            :key="col.name"
            :label="col.name + (col.notnull ? ' *' : '') + (col.type ? ` — ${col.type}` : '')"
            :hint="
              col.dflt_value !== null && col.dflt_value !== undefined
                ? 'Leave empty to use the database default'
                : col.notnull
                  ? 'Required'
                  : 'Leave empty for NULL/default'
            "
          >
            <UInput v-model="insertDraft[col.name]" class="w-full font-mono text-sm" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            variant="outline"
            color="neutral"
            class="cursor-pointer"
            @click="insertOpen = false"
          >
            Cancel
          </UButton>
          <UButton
            color="primary"
            class="cursor-pointer"
            :loading="writePending"
            @click="saveInsert"
          >
            Insert
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
