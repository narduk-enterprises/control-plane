import { and, desc, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { provisionJobs, provisionJobLogs, type ProvisionJob } from '#server/database/schema'
import { getWorkflowRun } from '#server/utils/provision-github'

const TERMINAL_STATUSES = new Set(['complete', 'failed'])
const GITHUB_RECONCILE_STALE_MS = 30_000
const PROVISION_WORKFLOW_REPO = 'narduk-enterprises/control-plane'

function isProvisionJobStale(job: ProvisionJob): boolean {
  const updatedAtMs = new Date(job.updatedAt).getTime()
  if (!Number.isFinite(updatedAtMs)) return true
  return Date.now() - updatedAtMs >= GITHUB_RECONCILE_STALE_MS
}

function buildGitHubFailureMessage(run: {
  id: number
  htmlUrl: string
  conclusion: string | null
}): string {
  switch (run.conclusion) {
    case 'cancelled':
      return `GitHub Actions run ${run.id} was cancelled. Open ${run.htmlUrl} for details.`
    case 'timed_out':
      return `GitHub Actions run ${run.id} timed out. Open ${run.htmlUrl} for details.`
    case 'action_required':
      return `GitHub Actions run ${run.id} needs manual action. Open ${run.htmlUrl} for details.`
    case 'stale':
      return `GitHub Actions run ${run.id} went stale. Open ${run.htmlUrl} for details.`
    case 'failure':
      return `GitHub Actions run ${run.id} failed. Open ${run.htmlUrl} for details.`
    default:
      return `GitHub Actions run ${run.id} finished with conclusion "${run.conclusion || 'unknown'}". Open ${run.htmlUrl} for details.`
  }
}

export async function reconcileProvisionJobWithGitHub(
  event: H3Event,
  job: ProvisionJob,
): Promise<ProvisionJob> {
  if (TERMINAL_STATUSES.has(job.status) || !job.githubRunId || !isProvisionJobStale(job)) {
    return job
  }

  const ghToken = useRuntimeConfig(event).controlPlaneGhServiceToken
  if (!ghToken) {
    return job
  }

  let run
  try {
    run = await getWorkflowRun(ghToken, PROVISION_WORKFLOW_REPO, job.githubRunId)
  } catch (error) {
    console.warn(`Failed to reconcile provision job ${job.id} with GitHub:`, error)
    return job
  }

  const db = useDatabase(event)
  const githubUpdates = {
    githubRunUrl: run.htmlUrl,
    githubRunStatus: run.status,
    githubRunConclusion: run.conclusion,
  }

  if (run.status !== 'completed' || run.conclusion === 'success') {
    if (
      job.githubRunUrl !== githubUpdates.githubRunUrl ||
      job.githubRunStatus !== githubUpdates.githubRunStatus ||
      job.githubRunConclusion !== githubUpdates.githubRunConclusion
    ) {
      await db.update(provisionJobs).set(githubUpdates).where(eq(provisionJobs.id, job.id))
      return { ...job, ...githubUpdates }
    }

    return job
  }

  const now = new Date().toISOString()
  const errorMessage = buildGitHubFailureMessage(run)

  await db
    .update(provisionJobs)
    .set({
      ...githubUpdates,
      status: 'failed',
      errorMessage,
      updatedAt: now,
    })
    .where(eq(provisionJobs.id, job.id))

  const latestGithubLog = await db
    .select({ message: provisionJobLogs.message })
    .from(provisionJobLogs)
    .where(and(eq(provisionJobLogs.provisionId, job.id), eq(provisionJobLogs.step, 'github')))
    .orderBy(desc(provisionJobLogs.createdAt))
    .limit(1)
    .get()

  if (latestGithubLog?.message !== errorMessage) {
    await db.insert(provisionJobLogs).values({
      id: crypto.randomUUID(),
      provisionId: job.id,
      level: 'error',
      step: 'github',
      message: errorMessage,
      createdAt: now,
    })
  }

  return {
    ...job,
    ...githubUpdates,
    status: 'failed',
    errorMessage,
    updatedAt: now,
  }
}
