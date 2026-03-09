import { z } from 'zod'
import { readBody, getHeader, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { fleetApps, provisionJobs } from '#server/database/schema'

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
 * Authenticated endpoint to provision a new fleet app. This is the entry point
 * for the two-phase async provisioning pipeline:
 *
 * Phase 1 (this endpoint, <5s):
 *   1. Validate auth via PROVISION_API_KEY
 *   2. Register app in fleet_apps D1
 *   3. Create GitHub repo via REST API
 *   4. Trigger provision-app.yml workflow_dispatch
 *   5. Return provisionId for polling
 *
 * Phase 2 (GitHub Action, ~5min):
 *   Runs init.ts, analytics, deploy, GSC verify, then calls back.
 */
export default defineEventHandler(async (event) => {
  // ── Auth: shared PROVISION_API_KEY ──
  const config = useRuntimeConfig(event)
  const authHeader = getHeader(event, 'authorization')
  const providedKey = authHeader?.replace('Bearer ', '')

  if (!config.provisionApiKey || providedKey !== config.provisionApiKey) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized — invalid or missing PROVISION_API_KEY',
    })
  }

  // ── Validate body ──
  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: `Validation error: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
    })
  }

  const { name, displayName, url, githubOrg } = parsed.data
  const githubRepo = `${githubOrg}/${name}`
  const now = new Date().toISOString()

  const db = useDatabase(event)

  // ── 1. Register in fleet_apps (409 if exists) ──
  const existing = await db.select().from(fleetApps).where(eq(fleetApps.name, name)).limit(1).all()

  if (existing.length > 0) {
    throw createError({
      statusCode: 409,
      message: `App '${name}' already exists in fleet registry.`,
    })
  }

  await db.insert(fleetApps).values({
    name,
    url,
    dopplerProject: name,
    githubRepo,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })

  // ── 2. Create provision job ──
  const provisionId = `prov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  await db.insert(provisionJobs).values({
    id: provisionId,
    appName: name,
    displayName,
    appUrl: url,
    githubRepo,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  })

  // ── 3. Create GitHub repo ──
  const ghToken = config.controlPlaneGhServiceToken
  if (!ghToken) {
    // Update job as failed — no GitHub token
    await db
      .update(provisionJobs)
      .set({
        status: 'failed',
        errorMessage: 'CONTROL_PLANE_GH_SERVICE_TOKEN not configured',
        updatedAt: now,
      })
      .where(eq(provisionJobs.id, provisionId))

    throw createError({
      statusCode: 500,
      message: 'GitHub service token not configured on control plane.',
    })
  }

  try {
    const repoRes = await fetch(`https://api.github.com/orgs/${githubOrg}/repos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
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
      // 422 = already exists, which is acceptable
      const errText = await repoRes.text().catch(() => '')
      await db
        .update(provisionJobs)
        .set({
          status: 'failed',
          errorMessage: `GitHub repo creation failed: ${repoRes.status} ${errText}`,
          updatedAt: now,
        })
        .where(eq(provisionJobs.id, provisionId))

      throw createError({
        statusCode: 502,
        message: `Failed to create GitHub repo: ${repoRes.status}`,
      })
    }
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string }
    if (error.statusCode) throw err // re-throw createError errors
    await db
      .update(provisionJobs)
      .set({ status: 'failed', errorMessage: `GitHub API error: ${error.message}`, updatedAt: now })
      .where(eq(provisionJobs.id, provisionId))

    throw createError({ statusCode: 502, message: `GitHub API error: ${error.message}` })
  }

  // ── 4. Trigger provision-app.yml workflow ──
  const templateRepo = 'narduk-enterprises/narduk-nuxt-template'
  const workflowFile = 'provision-app.yml'

  try {
    const dispatchRes = await fetch(
      `https://api.github.com/repos/${templateRepo}/actions/workflows/${workflowFile}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            'app-name': name,
            'display-name': displayName,
            'app-url': url,
            'github-repo': githubRepo,
            'provision-id': provisionId,
          },
        }),
      },
    )

    if (!dispatchRes.ok) {
      const errText = await dispatchRes.text().catch(() => '')
      await db
        .update(provisionJobs)
        .set({
          status: 'failed',
          errorMessage: `Workflow dispatch failed: ${dispatchRes.status} ${errText}`,
          updatedAt: now,
        })
        .where(eq(provisionJobs.id, provisionId))

      throw createError({
        statusCode: 502,
        message: `Failed to trigger provision workflow: ${dispatchRes.status}`,
      })
    }

    // Update job status → provisioning
    await db
      .update(provisionJobs)
      .set({ status: 'provisioning', updatedAt: now })
      .where(eq(provisionJobs.id, provisionId))
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string }
    if (error.statusCode) throw err
    await db
      .update(provisionJobs)
      .set({ status: 'failed', errorMessage: `Dispatch error: ${error.message}`, updatedAt: now })
      .where(eq(provisionJobs.id, provisionId))

    throw createError({ statusCode: 502, message: `Dispatch error: ${error.message}` })
  }

  return {
    ok: true,
    provisionId,
    app: name,
    githubRepo,
    status: 'provisioning',
    message: `App '${name}' registered and provisioning started. Poll GET /api/fleet/provision/${provisionId} for status.`,
  }
})
