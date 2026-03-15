import type { MaybeRefOrGetter } from 'vue'

interface FleetApp {
  name: string
}

/**
 * Composable for batch IndexNow submission across all fleet apps.
 */
export function useBatchIndexnow(apps: MaybeRefOrGetter<FleetApp[]>) {
  const submitting = ref(false)
  const submitted = ref(0)

  async function submitAll() {
    submitting.value = true
    submitted.value = 0
    try {
      const appList = toValue(apps)
      for (const app of appList) {
        try {
          await $fetch(`/api/fleet/indexnow/${encodeURIComponent(app.name)}`, { method: 'POST' })
          submitted.value++
        } catch {
          // Skip apps that don't have IndexNow configured
        }
      }
    } finally {
      submitting.value = false
    }
  }

  return { submitting, submitted, submitAll }
}
