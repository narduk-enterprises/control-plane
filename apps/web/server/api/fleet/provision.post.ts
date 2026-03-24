import { z } from 'zod'
import { createError } from 'h3'
import { eq } from 'drizzle-orm'
import { fleetApps, provisionJobs } from '#server/database/schema'
import { invalidateFleetAppListCache } from '#server/data/fleet-registry'
import { definePublicMutation, readValidatedMutationBody } from '#layer/server/utils/mutation'
import { assertProvisionApiKey } from '#server/utils/provision-api-auth'
import { triggerWorkflow } from '#server/utils/provision-github'
import { allocateFleetNuxtPort, buildLocalNuxtUrl } from '#server/utils/nuxt-port'

const bodySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9][a-z0-9-]*$/,
      'Must be lowercase alphanumeric with hyphens, starting with a letter or number',
    ),
  displayName: z.string().min(1).max(200),
  url: z.string().url(),
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
    const { name, displayName, url, githubOrg } = body
    const githubRepo = `${githubOrg}/${name}`
    const now = new Date().toISOString()
    const config = useRuntimeConfig(event)
    const db = useDatabase(event)

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
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
    }
    await invalidateFleetAppListCache(event)

    // ── 2. Create provision job ──
    const provisionId = `prov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    await db.insert(provisionJobs).values({
      id: provisionId,
      appName: name,
      displayName,
      appUrl: url,
      githubRepo,
      nuxtPort,
      status: 'pending',
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
          description: `${displayName} — provisioned by Narduk Control Plane`,
          private: false,
          auto_init: false,
        }),
      })

      if (!repoRes.ok && repoRes.status !== 422) {
        const errText = await repoRes.text().catch(() => '')
        throw new Error(`GitHub repo creation failed: ${repoRes.status} ${errText}`)
      }
    } catch (err: unknown) {
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
      await triggerWorkflow(ghToken, workflowRepo, 'provision-app.yml', {
        'app-name': name,
        'display-name': displayName,
        'app-url': url,
        'github-repo': githubRepo,
        'provision-id': provisionId,
        'nuxt-port': String(nuxtPort),
      })
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
