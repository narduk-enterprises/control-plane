import type { FleetDatabaseTableGridResponse, FleetDatabaseTablesResponse } from '~/types/fleet'
import type { FleetD1BindingRefs } from './useFleetD1Console'

function toQuery(
  binding: FleetD1BindingRefs,
  extra: Record<string, string | number> = {},
): Record<string, string | number> {
  const q: Record<string, string | number> = { ...extra }
  const dn = binding.databaseName.value.trim()
  if (dn) q.databaseName = dn
  const did = binding.databaseId.value.trim()
  if (did) q.databaseId = did
  const schemaName = binding.schemaName.value.trim()
  if (schemaName) q.schemaName = schemaName
  return q
}

/**
 * Drizzle-Studio-style table list + paginated grid for live fleet databases.
 */
export function useFleetD1StudioBrowse(appName: ComputedRef<string>, binding: FleetD1BindingRefs) {
  const pageSize = ref(50)
  const page = ref(1)
  const selectedTable = ref<string | null>(null)

  const tablesData = ref<FleetDatabaseTablesResponse | null>(null)
  const tablesPending = ref(false)
  const tablesError = ref('')

  const gridData = ref<FleetDatabaseTableGridResponse | null>(null)
  const gridPending = ref(false)
  const gridError = ref('')

  async function loadTables() {
    const name = appName.value
    if (!name) return
    tablesPending.value = true
    tablesError.value = ''
    try {
      tablesData.value = await $fetch<FleetDatabaseTablesResponse>(
        `/api/fleet/apps/${encodeURIComponent(name)}/database/tables`,
        { query: toQuery(binding) },
      )
    } catch (err) {
      const e = err as { data?: { message?: string }; message?: string }
      tablesData.value = null
      tablesError.value = e.data?.message || e.message || 'Failed to load tables'
    } finally {
      tablesPending.value = false
    }
  }

  async function loadGrid() {
    const name = appName.value
    const table = selectedTable.value
    if (!name || !table) {
      gridData.value = null
      return
    }
    gridPending.value = true
    gridError.value = ''
    const offset = (page.value - 1) * pageSize.value
    try {
      gridData.value = await $fetch<FleetDatabaseTableGridResponse>(
        `/api/fleet/apps/${encodeURIComponent(name)}/database/tables/${encodeURIComponent(table)}`,
        {
          query: toQuery(binding, {
            limit: pageSize.value,
            offset,
          }),
        },
      )
    } catch (err) {
      const e = err as { data?: { message?: string }; message?: string }
      gridData.value = null
      gridError.value = e.data?.message || e.message || 'Failed to load rows'
    } finally {
      gridPending.value = false
    }
  }

  const totalPages = computed(() => {
    const t = gridData.value?.total ?? 0
    const ps = pageSize.value
    return Math.max(1, Math.ceil(t / ps))
  })

  watch(
    [appName, binding.databaseName, binding.databaseId, binding.schemaName],
    () => {
      selectedTable.value = null
      gridData.value = null
      page.value = 1
      void loadTables()
    },
    { immediate: true },
  )

  watch([selectedTable, page, pageSize], () => {
    if (selectedTable.value) void loadGrid()
    else gridData.value = null
  })

  function selectTable(name: string) {
    selectedTable.value = name
    page.value = 1
  }

  return reactive({
    pageSize,
    page,
    selectedTable,
    tablesData,
    tablesPending,
    tablesError,
    gridData,
    gridPending,
    gridError,
    totalPages,
    loadTables,
    loadGrid,
    selectTable,
  })
}
