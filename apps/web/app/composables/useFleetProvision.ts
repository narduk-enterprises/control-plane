/**
 * Composable for the provision UI — manages provisioning new apps and
 * polling active provision jobs for live status updates.
 */

export interface ProvisionJob {
  id: string
  appName: string
  displayName: string
  appUrl: string
  githubRepo: string
  nuxtPort?: number | null
  status: string
  deployedUrl?: string | null
  gaPropertyId?: string | null
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
}

const TERMINAL_STATUSES = new Set(['complete', 'failed'])
const POLL_INTERVAL_MS = 5_000

export function useFleetProvision() {
  const toast = useToast()

  // ── Jobs list ──
  const {
    data: rawJobs,
    refresh: refreshJobs,
    status: jobsStatus,
  } = useFetch<{ jobs: ProvisionJob[] }>('/api/fleet/provision-ui/jobs', {
    default: () => ({ jobs: [] }),
    server: false,
    lazy: true,
  })

  const jobs = computed(() => rawJobs.value?.jobs ?? [])
  const activeJobs = computed(() => jobs.value.filter((j) => !TERMINAL_STATUSES.has(j.status)))
  const completedJobs = computed(() => jobs.value.filter((j) => j.status === 'complete'))
  const failedJobs = computed(() => jobs.value.filter((j) => j.status === 'failed'))

  // ── Auto-poll when there are active jobs ──
  const pollTimer = ref<ReturnType<typeof setInterval> | null>(null)

  function startPolling() {
    if (pollTimer.value) return
    pollTimer.value = setInterval(async () => {
      if (activeJobs.value.length === 0) {
        stopPolling()
        return
      }
      await refreshJobs()
    }, POLL_INTERVAL_MS)
  }

  function stopPolling() {
    if (pollTimer.value) {
      clearInterval(pollTimer.value)
      pollTimer.value = null
    }
  }

  // Start/stop polling based on active jobs
  watch(activeJobs, (active) => {
    if (active.length > 0) {
      startPolling()
    } else {
      stopPolling()
    }
  })

  // Clean up on unmount
  onUnmounted(() => stopPolling())

  // ── Provision ──
  const isProvisioning = ref(false)

  async function provisionApp(name: string, displayName: string, url: string) {
    isProvisioning.value = true
    try {
      const result = await $fetch<{ ok: boolean; provisionId: string; app: string }>(
        '/api/fleet/provision-ui',
        {
          method: 'POST',
          body: { name, displayName, url },
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        },
      )

      toast.add({
        title: 'Provisioning started',
        description: `${displayName} (${name}) is being provisioned. ID: ${result.provisionId}`,
        color: 'success',
      })

      // Refresh to show the new job, then start polling
      await refreshJobs()
      startPolling()

      return result
    } catch (err) {
      const error = err as { data?: { message?: string }; message?: string }
      toast.add({
        title: 'Provision failed',
        description: error.data?.message || error.message || 'Failed to start provisioning',
        color: 'error',
      })
      throw err
    } finally {
      isProvisioning.value = false
    }
  }

  return {
    jobs,
    activeJobs,
    completedJobs,
    failedJobs,
    jobsStatus,
    refreshJobs,
    isProvisioning,
    provisionApp,
  }
}
