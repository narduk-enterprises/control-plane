export interface OgPreviewItem {
  label: string
  path: string
  ogUrl: string
}

export interface OgPreviewCategory {
  title: string
  items: OgPreviewItem[]
}

/**
 * Hook to fetch OpenGraph image dashboard data.
 * Requires the host app to implement standard `/api/admin/og-image-data` returning `OgPreviewCategory[]`.
 */
export function useOgImageData() {
  return useAsyncData('layer-og-image-data', () =>
    $fetch<OgPreviewCategory[]>('/api/admin/og-image-data'),
  )
}
