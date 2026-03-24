import { z } from 'zod'
import { createError } from 'h3'
import { eq } from 'drizzle-orm'
import { fleetApps, provisionJobs } from '#server/database/schema'
import { invalidateFleetAppListCache } from '#server/data/fleet-registry'
import { definePublicMutation, readValidatedMutationBody } from '#layer/server/utils/mutation'
import { assertProvisionApiKey } from '#server/utils/provision-api-auth'
import { triggerWorkflow } from '#server/utils/provision-github'
import { allocateFleetNuxtPort, buildLocalNuxtUrl } from '#server/utils/nuxt-port'
import { buildProvisionWorkflowDispatchInputs } from '#server/utils/provision-workflow-dispatch'

const MAX_SHORT_DESCRIPTION_LENGTH = 350
const MAX_PROVISION_DESCRIPTION_LENGTH = 12_000
const MAX_GITHUB_REPO_DESCRIPTION_LENGTH = 350

function normalizeProvisionHeading(value: string): string {
  return value
    .replace(/^#+\s*/, '')
    .replaceAll(/[“”]/g, '"')
    .replaceAll('’', "'")
    .replaceAll(/[–—]/g, '-')
    .replace(/:+$/, '')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function summarizeProvisionDescription(description?: string): string {
  const trimmed = description?.trim()
  if (!trimmed) {
    return ''
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const recognizedHeadings = new Set([
    'product',
    'p1 (must ship in v1)',
    'core recipe features (in scope)',
    'expanded scope (previously "out of scope"-now in scope)',
    "expanded scope (previously 'out of scope'-now in scope)",
    'pages / routes (indicative)',
    'non-functional summary',
    'implementation guardrails - use the template first',
  ])

  const productLines: string[] = []
  let inProductSection = false

  for (const line of lines) {
    const normalized = normalizeProvisionHeading(line)

    if (normalized === 'product') {
      inProductSection = true
      continue
    }

    if (inProductSection && recognizedHeadings.has(normalized)) {
      break
    }

    if (inProductSection) {
      productLines.push(line)
    }
  }

  const summarySource =
    productLines.join(' ').trim() ||
    lines.find((line) => !recognizedHeadings.has(normalizeProvisionHeading(line))) ||
    trimmed

  return summarySource.replaceAll(/\s+/g, ' ').trim()
}

function buildGitHubRepoDescription(
  displayName: string,
  shortDescription?: string,
  description?: string,
): string {
  const fallback = `${displayName} — provisioned by Narduk Control Plane`
  const summary = shortDescription?.trim() || summarizeProvisionDescription(description) || fallback

  if (summary.length <= MAX_GITHUB_REPO_DESCRIPTION_LENGTH) {
    return summary
  }

  return `${summary.slice(0, MAX_GITHUB_REPO_DESCRIPTION_LENGTH - 3).trimEnd()}...`
}

const bodySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9][a-z0-9-]*$/,
      'Must be lowercase alphanumeric with hyphens, starting with a letter or number',
    ),
  displayName: z
    .string()
    .min(1)
    .max(200)
    .regex(
      /^[a-z0-9 \-'.&]+$/i,
      'Display name may only contain letters, numbers, spaces, hyphens, apostrophes, periods, and ampersands',
    ),
  url: z.string().url(),
  shortDescription: z.string().max(MAX_SHORT_DESCRIPTION_LENGTH).optional(),
  description: z.string().max(MAX_PROVISION_DESCRIPTION_LENGTH).optional(),
  githubOrg: z.string().min(1).optional().default('narduk-enterprises'),
})

/**
 * POST /api/fleet/provision
 *
 * Authenticated endpoint to provision a new fleet app.
 *
 *   1. Upsert app in fleet_apps D1 (update if exists, insert if new)
 *   2. Create bare GitHub repo
 *   3. Dispatch provision-app.yml GitHub workflow
 *
 * All heavier infrastructure provisioning is now done by granular micro-scripts
 * running inside the provision-app.yml GitHub Actions workflow.
 */
export default definePublicMutation(
  {
    rateLimit: { namespace: 'fleet-provision', maxRequests: 5, windowMs: 60_000 },
    parseBody: async (event) => {
      assertProvisionApiKey(event, 'Unauthorized — invalid or missing PROVISION_API_KEY')
      return readValidatedMutationBody(event, bodySchema.parse)
    },
  },
  async ({ event, body }) => {
    const { name, displayName, url, shortDescription, description, githubOrg } = body
    const githubRepo = `${githubOrg}/${name}`
    const now = new Date().toISOString()
    const config = useRuntimeConfig(event)
    const db = useDatabase(event)
    const agentDescription = description?.trim() || shortDescription?.trim() || undefined

    /** Helper: update provision job status + optional details */
    async function updateStatus(
      provisionId: string,
      status: string,
      extra?: { errorMessage?: string },
    ) {
      await db
        .update(provisionJobs)
        .set({ status, ...extra, updatedAt: new Date().toISOString() })
        .where(eq(provisionJobs.id, provisionId))
    }

    // ── 1. Register in fleet_apps (idempotent: upsert) ──
    const existing = await db
      .select()
      .from(fleetApps)
      .where(eq(fleetApps.name, name))
      .limit(1)
      .all()
    const usedPorts = (
      await db.select({ name: fleetApps.name, nuxtPort: fleetApps.nuxtPort }).from(fleetApps).all()
    )
      .filter((app) => app.name !== name)
      .map((app) => app.nuxtPort)
    const nuxtPort = allocateFleetNuxtPort(usedPorts, existing[0]?.nuxtPort)
    const localDevUrl = buildLocalNuxtUrl(nuxtPort)

    if (existing.length > 0) {
      await db
        .update(fleetApps)
        .set({
          url,
          githubRepo,
          nuxtPort,
          appDescription: agentDescription ?? null,
          isActive: true,
          updatedAt: now,
        })
        .where(eq(fleetApps.name, name))
    } else {
      await db.insert(fleetApps).values({
        name,
        url,
        dopplerProject: name,
        githubRepo,
        nuxtPort,
        appDescription: agentDescription ?? null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
    }
    await invalidateFleetAppListCache(event)

    // ── 2. Create provision job ──
    const provisionId = `prov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const dispatchInputs = buildProvisionWorkflowDispatchInputs({
      appName: name,
      displayName,
      appUrl: url,
      githubRepo,
      provisionId,
      nuxtPort: String(nuxtPort),
      appShortDescription: shortDescription,
      appDescription: agentDescription,
    })

    await db.insert(provisionJobs).values({
      id: provisionId,
      appName: name,
      displayName,
      appUrl: url,
      githubRepo,
      nuxtPort,
      status: 'pending',
      dispatchInputsJson: JSON.stringify(dispatchInputs),
      createdAt: now,
      updatedAt: now,
    })

    const ghToken = config.controlPlaneGhServiceToken
    if (!ghToken) {
      await updateStatus(provisionId, 'failed', {
        errorMessage: 'CONTROL_PLANE_GH_SERVICE_TOKEN not configured',
      })
      throw createError({
        statusCode: 500,
        message: 'GitHub service token not configured on control plane.',
      })
    }

    // ── 3. Create bare GitHub repo ──
    await updateStatus(provisionId, 'creating_repo')

    try {
      const repoRes = await fetch(`https://api.github.com/orgs/${githubOrg}/repos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'narduk-control-plane',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          name,
          description: buildGitHubRepoDescription(displayName, shortDescription, agentDescription),
          private: false,
          auto_init: false,
        }),
      })

      if (!repoRes.ok) {
        const errText = await repoRes.text().catch(() => '')
        if (repoRes.status === 422) {
          await updateStatus(provisionId, 'failed', {
            errorMessage:
              'GitHub repository already exists. Use Retry on this job to run the workflow (no second repo create), or choose a different app name / delete the empty repo.',
          })
          throw createError({
            statusCode: 409,
            message:
              'Repository already exists. The job is marked failed; open Fleet provisioning and use Retry if that repo should receive the template, or pick another name.',
          })
        }
        throw new Error(`GitHub repo creation failed: ${repoRes.status} ${errText}`)
      }
    } catch (err: unknown) {
      const h3 = err as { statusCode?: number }
      if (h3.statusCode === 409) throw err
      const error = err as { message?: string }
      await updateStatus(provisionId, 'failed', {
        errorMessage: `Repo creation: ${error.message}`,
      })
      throw createError({
        statusCode: 502,
        message: `GitHub repo creation error: ${error.message}`,
      })
    }

    // ── 4. Dispatch GitHub Action ──
    await updateStatus(provisionId, 'dispatching')

    const workflowRepo = 'narduk-enterprises/control-plane'

    try {
      await triggerWorkflow(ghToken, workflowRepo, 'provision-app.yml', dispatchInputs)
    } catch (err: unknown) {
      const error = err as { message?: string }
      await updateStatus(provisionId, 'failed', {
        errorMessage: `Workflow dispatch: ${error.message}`,
      })
      throw createError({
        statusCode: 502,
        message: `Workflow dispatch failed: ${error.message}`,
      })
    }

    return {
      ok: true,
      provisionId,
      app: name,
      githubRepo,
      status: 'dispatching',
      infrastructure: {
        nuxtPort,
      },
      message: `App '${name}' registered and workflow dispatched. Local dev will use ${localDevUrl}. Poll GET /api/fleet/provision/${provisionId} for status.`,
    }
  },
)
