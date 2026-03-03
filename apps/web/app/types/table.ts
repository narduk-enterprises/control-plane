/**
 * Minimal UTable column type for apps/web (avoids @nuxt/ui type resolution in CI).
 * Compatible with Nuxt UI UTable columns prop at runtime.
 */
export interface TableColumn<T = unknown> {
  id?: string
  accessorKey?: keyof T & string
  header?: string | (() => unknown)
  cell?: (args: { row: { original: T } }) => unknown
  meta?: { class?: { th?: string; td?: string } }
  enableSorting?: boolean
}
