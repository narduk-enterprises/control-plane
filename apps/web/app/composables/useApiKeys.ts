/**
 * Composable for managing API keys (CRUD operations).
 */
export interface ApiKeyItem {
  id: string
  name: string
  keyPrefix: string
  lastUsedAt: string | null
  expiresAt: number | null
  createdAt: string
}

export function useApiKeys() {
  const keys = ref<ApiKeyItem[]>([])
  const loading = ref(false)

  async function fetchKeys() {
    loading.value = true
    try {
      keys.value = await $fetch<ApiKeyItem[]>('/api/auth/api-keys')
    } catch {
      /* ignore */
    } finally {
      loading.value = false
    }
  }

  async function createKey(name: string) {
    const result = await $fetch<{ rawKey: string }>('/api/auth/api-keys', {
      method: 'POST',
      body: { name },
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
    await fetchKeys()
    return result.rawKey
  }

  async function deleteKey(id: string) {
    await $fetch(`/api/auth/api-keys/${id}`, {
      method: 'DELETE',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
    await fetchKeys()
  }

  return { keys, loading, fetchKeys, createKey, deleteKey }
}
