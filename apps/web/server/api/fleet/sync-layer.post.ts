import { requireAdmin } from '#layer/server/utils/auth'
import { z } from 'zod'
import { getSyncManagedRepos } from '#server/data/managed-repos'

const TEMPLATE_REPO = 'narduk-enterprises/narduk-nuxt-template'
const WORKFLOW_FILE = 'template-sync-bot.yml'

/**
 * POST /api/fleet/sync-layer
 *
 * Triggers the PR-based template sync workflow on the template repo via GitHub API.
 * This opens or updates sync PRs for the selected managed repos.
 *
 * Body: { dryRun?: boolean, repos?: string[] }
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readValidatedBody(
    event,
    z.object({
      dryRun: z.boolean().optional().default(false),
      repos: z.array(z.string().regex(/^[a-z0-9-]+$/)).optional(),
    }).parse,
  )

  const allowedRepos = new Set(getSyncManagedRepos().map((repo) => repo.name))
  const requestedRepos = [...new Set(body.repos ?? [])]
  const invalidRepos = requestedRepos.filter((repo) => !allowedRepos.has(repo))
  if (invalidRepos.length > 0) {
    throw createError({
      statusCode: 400,
      message: `Unknown or unmanaged repos requested: ${invalidRepos.join(', ')}`,
    })
  }

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
        inputs: {
          'dry-run': String(body.dryRun),
          repos: requestedRepos.join(','),
        },
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
    repos: requestedRepos.length > 0 ? requestedRepos : [...allowedRepos].sort(),
    message: body.dryRun
      ? 'Template sync workflow triggered in dry-run mode'
      : 'Template sync workflow triggered — sync PRs will be created or updated',
    workflowUrl: `https://github.com/${TEMPLATE_REPO}/actions/workflows/${WORKFLOW_FILE}`,
  }
})
