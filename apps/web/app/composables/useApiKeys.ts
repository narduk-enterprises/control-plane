/**
 * Composable for managing API keys (CRUD operations).
 * Uses useFetch for list, $fetch for mutations.
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
  const {
    data: keys,
    status,
    refresh,
  } = useFetch<ApiKeyItem[]>('/api/auth/api-keys', {
    default: () => [],
    lazy: true,
    server: false,
  })

  const loading = computed(() => status.value === 'pending')

  async function createKey(name: string) {
    const result = await $fetch<{ rawKey: string }>('/api/auth/api-keys', {
      method: 'POST',
      body: { name },
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
    await refresh()
    return result.rawKey
  }

  async function deleteKey(id: string) {
    await $fetch(`/api/auth/api-keys/${id}`, {
      method: 'DELETE',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
    await refresh()
  }

  return { keys, loading, fetchKeys: refresh, createKey, deleteKey }
}
