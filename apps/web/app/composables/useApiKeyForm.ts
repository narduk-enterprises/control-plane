/**
 * Composable encapsulating API-key creation/deletion UI state.
 * Delegates CRUD to useApiKeys(); owns only the ephemeral form refs.
 */
export function useApiKeyForm() {
  const {
    keys: apiKeysList,
    loading: apiKeysLoading,
    fetchKeys,
    createKey,
    deleteKey,
  } = useApiKeys()

  const newKeyName = ref('')
  const newKeyLoading = ref(false)
  const newKeyRaw = ref('') // shown once after creation
  const newKeyCopied = ref(false)
  const deleteKeyId = ref<string | null>(null)

  async function handleCreate() {
    if (!newKeyName.value.trim()) return
    newKeyLoading.value = true
    newKeyRaw.value = ''
    newKeyCopied.value = false
    try {
      newKeyRaw.value = await createKey(newKeyName.value.trim())
      newKeyName.value = ''
    } catch {
      /* ignore */
    } finally {
      newKeyLoading.value = false
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteKey(id)
      deleteKeyId.value = null
    } catch {
      /* ignore */
    }
  }

  function copyKey() {
    navigator.clipboard.writeText(newKeyRaw.value)
    newKeyCopied.value = true
  }

  function formatDate(iso: string | null) {
    if (!iso) return 'Never'
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  onMounted(() => {
    fetchKeys()
  })

  return {
    apiKeysList,
    apiKeysLoading,
    newKeyName,
    newKeyLoading,
    newKeyRaw,
    newKeyCopied,
    deleteKeyId,
    handleCreate,
    handleDelete,
    copyKey,
    formatDate,
  }
}
