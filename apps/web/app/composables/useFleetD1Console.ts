import type { FleetDatabaseQueryResponse } from '~/types/fleet'

export interface FleetD1BindingRefs {
  databaseName: Ref<string>
  databaseId: Ref<string>
  schemaName: Ref<string>
  showAdvanced: Ref<boolean>
}

/**
 * Admin SQL console against a fleet app's live database.
 * Pass `binding` to share connection overrides with the studio browser.
 */
export function useFleetD1Console(appName: ComputedRef<string>, binding?: FleetD1BindingRefs) {
  const fallbackName = ref('')
  const fallbackId = ref('')
  const fallbackSchema = ref('public')
  const fallbackShowAdvanced = ref(false)

  const sql = ref(
    '-- Read/write production database.\n-- Semicolons split statements for console execution.\n\nSELECT 1;',
  )
  const databaseName = binding?.databaseName ?? fallbackName
  const databaseId = binding?.databaseId ?? fallbackId
  const schemaName = binding?.schemaName ?? fallbackSchema
  const showAdvanced = binding?.showAdvanced ?? fallbackShowAdvanced
  const loading = ref(false)
  const mutationPending = ref(false)
  const errorMessage = ref('')
  const lastResponse = ref<FleetDatabaseQueryResponse | null>(null)

  const canRun = computed(() => sql.value.trim().length > 0 && appName.value.length > 0)

  function clearResults() {
    lastResponse.value = null
    errorMessage.value = ''
  }

  async function run() {
    const name = appName.value
    if (!name || !sql.value.trim()) return

    loading.value = true
    errorMessage.value = ''
    lastResponse.value = null

    const body: {
      sql: string
      databaseName?: string
      databaseId?: string
    } = { sql: sql.value.trim() }

    const dn = databaseName.value.trim()
    if (dn) body.databaseName = dn
    const did = databaseId.value.trim()
    if (did) body.databaseId = did

    try {
      lastResponse.value = await $fetch<FleetDatabaseQueryResponse>(
        `/api/fleet/apps/${encodeURIComponent(name)}/database/query`,
        {
          method: 'POST',
          body,
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        },
      )
    } catch (err) {
      const e = err as { data?: { message?: string }; message?: string; statusMessage?: string }
      errorMessage.value = e.data?.message || e.message || e.statusMessage || 'Query failed'
    } finally {
      loading.value = false
    }
  }

  /** Parameterized writes for the studio grid (same endpoint as the SQL console). */
  async function runParameterizedMutation(op: {
    sql: string
    params: Array<string | number | boolean | null>
  }) {
    const name = appName.value
    if (!name) throw new Error('Missing app name')

    mutationPending.value = true
    try {
      const body: Record<string, unknown> = { sql: op.sql }
      if (op.params.length > 0) body.params = op.params
      const dn = databaseName.value.trim()
      if (dn) body.databaseName = dn
      const did = databaseId.value.trim()
      if (did) body.databaseId = did

      await $fetch<FleetDatabaseQueryResponse>(
        `/api/fleet/apps/${encodeURIComponent(name)}/database/query`,
        {
          method: 'POST',
          body,
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        },
      )
    } finally {
      mutationPending.value = false
    }
  }

  return {
    sql,
    databaseName,
    databaseId,
    schemaName,
    showAdvanced,
    loading,
    mutationPending,
    errorMessage,
    lastResponse,
    canRun,
    run,
    runParameterizedMutation,
    clearResults,
  }
}
