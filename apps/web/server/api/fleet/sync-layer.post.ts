import { requireAdmin } from '#layer/server/utils/auth'
import { z } from 'zod'

const TEMPLATE_REPO = 'narduk-enterprises/narduk-nuxt-template'
const WORKFLOW_FILE = 'sync-fleet.yml'

/**
 * POST /api/fleet/sync-layer
 *
 * Triggers the sync-fleet.yml workflow on the template repo via GitHub API.
 * This runs update-layer.ts on all fleet apps, commits, and pushes.
 *
 * Body: { dryRun?: boolean }
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readValidatedBody(
    event,
    z.object({
      dryRun: z.boolean().optional().default(false),
    }).parse,
  )

  const config = useRuntimeConfig()
  const token = config.githubToken
  if (!token) {
    throw createError({ statusCode: 500, message: 'GitHub token not configured' })
  }

  const res = await fetch(
    `https://api.github.com/repos/${TEMPLATE_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Narduk-Control-Plane',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: { 'dry-run': String(body.dryRun) },
      }),
    },
  )

  if (!res.ok) {
    const error = await res.text()
    throw createError({
      statusCode: res.status,
      message: `GitHub API error: ${error}`,
    })
  }

  return {
    success: true,
    dryRun: body.dryRun,
    message: body.dryRun
      ? 'Sync Fleet workflow triggered (dry-run mode — no changes will be pushed)'
      : 'Sync Fleet workflow triggered — all fleet apps will be updated and pushed',
    workflowUrl: `https://github.com/${TEMPLATE_REPO}/actions/workflows/${WORKFLOW_FILE}`,
  }
})
