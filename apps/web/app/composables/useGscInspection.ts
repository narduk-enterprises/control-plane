/**
 * Composable for GSC URL inspection data formatting.
 * Shared GSC inspection URL builder for analytics views.
 */
import type { GscInspection } from '~/types/analytics'

export function useGscInspection(
  inspection: Ref<GscInspection | null> | ComputedRef<GscInspection | null>,
) {
  const formattedLastCrawlTime = computed(() => {
    const t = inspection.value?.indexStatusResult?.lastCrawlTime
    if (!t) return null
    try {
      return new Date(t).toLocaleString()
    } catch {
      return t
    }
  })

  const formattedCrawledAs = computed(() => inspection.value?.indexStatusResult?.crawledAs ?? null)

  const verdict = computed(() => inspection.value?.indexStatusResult?.verdict ?? null)

  const coverageState = computed(
    () => inspection.value?.indexStatusResult?.coverageState ?? 'Unknown coverage state',
  )
  const indexingState = computed(() => inspection.value?.indexStatusResult?.indexingState ?? null)
  const pageFetchState = computed(() => inspection.value?.indexStatusResult?.pageFetchState ?? null)
  const robotsTxtState = computed(() => inspection.value?.indexStatusResult?.robotsTxtState ?? null)
  const sitemap = computed(() => inspection.value?.indexStatusResult?.sitemap ?? [])
  const googleCanonical = computed(
    () => inspection.value?.indexStatusResult?.googleCanonical ?? null,
  )
  const userCanonical = computed(() => inspection.value?.indexStatusResult?.userCanonical ?? null)

  const inspectionLink = computed(() => inspection.value?.inspectionResultLink ?? null)

  const isPass = computed(() => verdict.value === 'PASS')

  return {
    formattedLastCrawlTime,
    formattedCrawledAs,
    verdict,
    coverageState,
    indexingState,
    pageFetchState,
    robotsTxtState,
    sitemap,
    googleCanonical,
    userCanonical,
    inspectionLink,
    isPass,
  }
}
