/**
 * Composable for Google Indexing API publish action.
 * Uses $fetch for one-shot POST mutations — not useFetch.
 */
export function useIndexingPublish() {
  const data = ref<unknown>(null)
  const error = ref<Error | null>(null)
  const loading = ref(false)

  async function submitUrl(url: string, type = 'URL_UPDATED') {
    loading.value = true
    error.value = null
    try {
      const result = await $fetch('/api/fleet/indexing/publish', {
        method: 'POST',
        body: { url, type },
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      data.value = result
      return result
    } catch (err) {
      error.value = err as Error
      return null
    } finally {
      loading.value = false
    }
  }

  return { data, error, loading, submitUrl }
}

/**
 * Composable for Google Indexing API URL status check.
 * Uses $fetch for one-shot GET queries — not useFetch.
 */
export function useIndexingStatus() {
  const data = ref<unknown>(null)
  const error = ref<Error | null>(null)
  const loading = ref(false)

  async function checkStatus(url: string) {
    loading.value = true
    error.value = null
    try {
      const result = await $fetch('/api/fleet/indexing/status', {
        query: { url },
      })
      data.value = result
      return result
    } catch (err) {
      error.value = err as Error
      return null
    } finally {
      loading.value = false
    }
  }

  return { data, error, loading, checkStatus }
}
