import type { MaybeRefOrGetter } from 'vue'

interface FleetApp {
  name: string
}

/**
 * Batch GSC sitemap submit across all fleet apps (force=true per app).
 */
export function useBatchGscSitemap(apps: MaybeRefOrGetter<FleetApp[]>) {
  const submitting = ref(false)
  const submitted = ref(0)
  const failed = ref(0)

  async function submitAll(): Promise<{ ok: number; fail: number }> {
    submitting.value = true
    submitted.value = 0
    failed.value = 0
    try {
      const appList = toValue(apps)
      for (const app of appList) {
        try {
          await $fetch(`/api/fleet/gsc-sitemap/${encodeURIComponent(app.name)}`, {
            method: 'POST',
            body: { force: true },
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
          })
          submitted.value++
        } catch {
          failed.value++
        }
      }
      return { ok: submitted.value, fail: failed.value }
    } finally {
      submitting.value = false
    }
  }

  return { submitting, submitted, failed, submitAll }
}
