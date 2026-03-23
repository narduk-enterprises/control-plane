import type { MaybeRefOrGetter } from 'vue'
import { getNuxtCachedData, markNuxtFetchedAt } from '~/utils/fetchCache'

type FleetAnalyticsQuery = Record<string, string | undefined>

function sanitizeQuery(query: FleetAnalyticsQuery): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => typeof value === 'string' && value.length > 0),
  ) as Record<string, string>
}

export function useFleetAnalyticsRequest<TData>(
  path: MaybeRefOrGetter<string>,
  fetchKey: MaybeRefOrGetter<string>,
  query: MaybeRefOrGetter<FleetAnalyticsQuery>,
) {
  const nuxtApp = useNuxtApp()
  const appFetch = useAppFetch()

  const requestPath = computed(() => toValue(path))
  const requestKey = computed(() => toValue(fetchKey))
  const requestQuery = computed(() => sanitizeQuery(toValue(query)))
  const data = shallowRef<TData | null>(null)
  const error = shallowRef<Error | null>(null)
  const loading = ref(false)
  let requestSequence = 0

  function hydrateFromCache(key: string) {
    const cached = getNuxtCachedData<TData>(key, nuxtApp)
    if (cached !== undefined) {
      data.value = cached
      error.value = null
      return true
    }

    return false
  }

  async function load(force = false) {
    if (!requestPath.value || requestPath.value.endsWith('/_')) return

    const key = requestKey.value
    if (!force && hydrateFromCache(key)) return

    const sequence = ++requestSequence
    loading.value = true

    try {
      const response = await appFetch<TData>(requestPath.value, { query: requestQuery.value })
      if (sequence !== requestSequence) return

      data.value = response
      error.value = null
      ;(nuxtApp.payload.data as Record<string, unknown>)[key] = response as unknown
      markNuxtFetchedAt(nuxtApp, key)
    } catch (caught) {
      if (sequence !== requestSequence) return
      error.value = caught instanceof Error ? caught : new Error(String(caught))
      throw caught
    } finally {
      if (sequence === requestSequence) {
        loading.value = false
      }
    }
  }

  watch(
    requestKey,
    (key) => {
      hydrateFromCache(key)
    },
    { immediate: true },
  )

  return {
    data,
    error,
    loading,
    load,
  }
}
