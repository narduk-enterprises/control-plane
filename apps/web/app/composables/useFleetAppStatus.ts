import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

export function useFleetAppStatus(urlParam: MaybeRefOrGetter<string | undefined>) {
    const url = computed(() => toValue(urlParam))

    // Disable fetch if URL is not provided or literally 'undefined'
    const requestUrl = (() => {
        if (!url.value || url.value === 'undefined') return null
        return '/api/fleet/status'
    }) as unknown as () => string

    return useFetch<{ status: string }>(requestUrl, {
        query: { url },
        lazy: true,
        server: false,
    })
}
