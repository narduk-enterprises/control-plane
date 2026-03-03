import type { MaybeRefOrGetter } from 'vue'

export function useFleetAppStatus(url: MaybeRefOrGetter<string>) {
    return useFetch('/api/fleet/status', {
        query: { url },
        lazy: true,
        server: false,
    })
}
