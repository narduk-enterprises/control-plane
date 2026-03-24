/**
 * Composable for the provision UI — manages provisioning new apps and
 * polling active provision jobs for live status updates.
 */

export interface ProvisionJobLog {
  id: string
  provisionId: string
  level: string
  message: string
  step?: string | null
  createdAt: string
}

export interface ProvisionJob {
  id: string
  appName: string
  displayName: string
  appUrl: string
  githubRepo: string
  nuxtPort?: number | null
  appDescription?: string | null
  status: string
  githubRunId?: string | null
  githubRunUrl?: string | null
  githubRunStatus?: string | null
  githubRunConclusion?: string | null
  deployedUrl?: string | null
  gaPropertyId?: string | null
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
  logs?: ProvisionJobLog[]
}

const TERMINAL_STATUSES = new Set(['complete', 'failed'])
const POLL_INTERVAL_MS = 5_000

interface ProvisionRequestInput {
  name: string
  displayName: string
  url: string
  shortDescription?: string
  description?: string
}

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
  const lastKnownStatuses = ref<Record<string, string>>({})

  watch(
    jobs,
    (nextJobs) => {
      const nextStatuses: Record<string, string> = {}

      for (const job of nextJobs) {
        const previousStatus = lastKnownStatuses.value[job.id]
        nextStatuses[job.id] = job.status

        if (!previousStatus || previousStatus === job.status) {
          continue
        }

        if (job.status === 'failed') {
          toast.add({
            title: 'Provision failed',
            description: job.errorMessage || `${job.displayName} failed in GitHub Actions.`,
            color: 'error',
          })
        } else if (job.status === 'complete') {
          toast.add({
            title: 'Provision complete',
            description: `${job.displayName} is ready.`,
            color: 'success',
          })
        }
      }

      lastKnownStatuses.value = nextStatuses
    },
    { immediate: true },
  )

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

  async function provisionApp(input: ProvisionRequestInput) {
    const { name, displayName } = input
    isProvisioning.value = true
    try {
      const result = await $fetch<{ ok: boolean; provisionId: string; app: string }>(
        '/api/fleet/provision-ui',
        {
          method: 'POST',
          body: input,
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
      await refreshJobs()
      throw err
    } finally {
      isProvisioning.value = false
    }
  }

  async function retryJob(id: string) {
    isProvisioning.value = true
    try {
      await $fetch(`/api/fleet/provision/${id}/retry`, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      toast.add({
        title: 'Retry started',
        description: `Provision job ${id} is being retried.`,
        color: 'success',
      })
      await refreshJobs()
      startPolling()
    } catch (err) {
      const error = err as { data?: { message?: string }; message?: string }
      toast.add({
        title: 'Retry failed',
        description: error.data?.message || error.message || 'Failed to retry job',
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
    retryJob,
  }
}
