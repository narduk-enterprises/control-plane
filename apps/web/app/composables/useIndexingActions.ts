export function useIndexingPublish() {
  const publishBody = ref<{ url: string; type?: string }>({ url: '', type: 'URL_UPDATED' })
  const { data, error, pending, refresh } = useFetch('/api/fleet/indexing/publish', {
    method: 'POST',
    body: publishBody,
    immediate: false,
  })
  async function submitUrl(url: string, type = 'URL_UPDATED') {
    publishBody.value = { url, type }
    await refresh()
    return data.value
  }
  return { data, error, loading: pending, submitUrl }
}

export function useIndexingStatus() {
  const statusUrl = ref('')
  const key = computed(
    () => `/api/fleet/indexing/status?url=${encodeURIComponent(statusUrl.value)}`,
  )
  const { data, error, pending, refresh } = useFetch(key, { immediate: false })
  async function checkStatus(url: string) {
    statusUrl.value = url
    await refresh()
    return data.value
  }
  return { data, error, loading: pending, checkStatus }
}
