/**
 * Composable for GSC table sorting and CSV export.
 * Extracted from FleetAppGscPanel.vue to keep the component under 300 LOC.
 */
type GscRow = {
  keys?: string[]
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
}

type SortKey = 'key' | 'clicks' | 'impressions' | 'ctr' | 'position'

export function useGscTableSort(rawRows: Ref<GscRow[]>, dimensionLabel: Ref<string>) {
  const sortKey = ref<SortKey>('key')
  const sortDir = ref<'asc' | 'desc'>('asc')

  function sortIndicator(key: SortKey) {
    if (sortKey.value !== key) return ''
    return sortDir.value === 'desc' ? '↓' : '↑'
  }

  function setSort(key: SortKey) {
    if (sortKey.value === key) {
      sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
    } else {
      sortKey.value = key
      sortDir.value = key === 'key' ? 'asc' : 'desc'
    }
  }

  const tableRows = computed(() => {
    const rows = rawRows.value
    const key = sortKey.value
    const dir = sortDir.value
    return [...rows].sort((a, b) => {
      if (key === 'key') {
        const va = a.keys?.[0] ?? ''
        const vb = b.keys?.[0] ?? ''
        return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      const va = a[key] ?? 0
      const vb = b[key] ?? 0
      return dir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  })

  const csvContent = computed(() => {
    const rows = tableRows.value
    const dim = dimensionLabel.value
    const header = [dim, 'Clicks', 'Impressions', 'CTR', 'Position'].join(',')
    const body = rows
      .map((r) => {
        const key = (r.keys?.[0] ?? '').replaceAll('"', '""')
        return [
          `"${key}"`,
          r.clicks ?? 0,
          r.impressions ?? 0,
          (r.ctr ?? 0).toFixed(2),
          (r.position ?? 0).toFixed(1),
        ].join(',')
      })
      .join('\n')
    return [header, body].join('\n')
  })

  function copyCsv() {
    if (!csvContent.value) return
    navigator.clipboard.writeText(csvContent.value)
  }

  return { sortKey, sortDir, sortIndicator, setSort, tableRows, csvContent, copyCsv }
}
