export function useIndexingPublish() {
  const publishBody = ref<{ url: string; type?: string }>({ url: '', type: 'URL_UPDATED' })
  const { data, error, pending, refresh } = useFetch('/api/fleet/indexing/publish', {
    method: 'POST',
    body: publishBody,
    immediate: false,
    server: false,
    watch: false,
  })
  async function submitUrl(url: string, type = 'URL_UPDATED') {
    publishBody.value = { url, type }
    await nextTick()
    await refresh()
    return data.value
  }
  return { data, error, loading: pending, submitUrl }
}

export function useIndexingStatus() {
  const statusUrl = ref('')

  const query = computed(() => {
    if (!statusUrl.value) return {}
    return { url: statusUrl.value }
  })

  const { data, error, pending, refresh } = useFetch('/api/fleet/indexing/status', {
    query,
    immediate: false,
    server: false,
    watch: false,
  })

  async function checkStatus(inputUrl: string) {
    statusUrl.value = inputUrl
    await nextTick()
    await refresh()
    return data.value
  }

  return { data, error, loading: pending, checkStatus }
}
