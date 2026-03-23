import type { NuxtApp } from '#app'

export const DEFAULT_CLIENT_CACHE_MAX_AGE_MS = 5 * 60 * 1000

type NuxtFetchPayload = NuxtApp['payload'] & {
  _clientFetchedAt?: Record<string, number>
}

export function markNuxtFetchedAt(nuxtApp: NuxtApp, key: string, timestamp = Date.now()) {
  const payload = nuxtApp.payload as NuxtFetchPayload
  payload._clientFetchedAt = payload._clientFetchedAt ?? {}
  payload._clientFetchedAt[key] = timestamp
}

export function getNuxtCachedData<T>(
  key: string,
  nuxtApp: NuxtApp,
  maxAgeMs = DEFAULT_CLIENT_CACHE_MAX_AGE_MS,
) {
  const cached = nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
  if (cached === undefined) return

  const fetchedAt = (nuxtApp.payload as NuxtFetchPayload)._clientFetchedAt?.[key]
  if (!fetchedAt) return cached as T
  if (Date.now() - fetchedAt < maxAgeMs) return cached as T
}
