import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getHeader, createError, getRouterParam } from 'h3'
import { fleetApps, provisionJobs } from '#server/database/schema'

const querySchema = z.object({
  deleteRepo: z.enum(['true', 'false']).optional().default('false'),
})

/**
 * DELETE /api/fleet/provision/[id]
 *
 * Cleanup a provisioned app: removes the provision job, fleet_apps entry,
 * and optionally deletes the GitHub repo. Auth'd via PROVISION_API_KEY.
 *
 * Query params:
 *   ?deleteRepo=true  — also delete the GitHub repo (default: false)
 */
export default defineEventHandler(async (event) => {
  // Auth
  const config = useRuntimeConfig(event)
  const authHeader = getHeader(event, 'authorization')
  const providedKey = authHeader?.replace('Bearer ', '')

  if (!config.provisionApiKey || providedKey !== config.provisionApiKey) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing provision job ID' })
  }

  const db = useDatabase(event)

  // Find the provision job
  const jobs = await db.select().from(provisionJobs).where(eq(provisionJobs.id, id)).limit(1).all()

  if (jobs.length === 0) {
    throw createError({ statusCode: 404, message: `Provision job '${id}' not found.` })
  }

  const job = jobs[0]!
  const rawQuery = getQuery(event)
  const query = querySchema.parse(rawQuery)
  const deleteRepo = query.deleteRepo === 'true'
  const cleaned: string[] = []

  // 1. Optionally delete GitHub repo
  if (deleteRepo && job.githubRepo) {
    const ghToken = config.controlPlaneGhServiceToken
    if (ghToken) {
      try {
        const res = await fetch(`https://api.github.com/repos/${job.githubRepo}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${ghToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        })
        if (res.ok || res.status === 404) {
          cleaned.push(`GitHub repo ${job.githubRepo} deleted`)
        } else {
          cleaned.push(
            `GitHub repo deletion failed: ${res.status} (may require delete permissions on PAT)`,
          )
        }
      } catch {
        cleaned.push('GitHub repo deletion failed (network error)')
      }
    } else {
      cleaned.push('GitHub repo deletion skipped (no GH token)')
    }
  }

  // 2. Delete fleet_apps entry
  await db.delete(fleetApps).where(eq(fleetApps.name, job.appName))
  cleaned.push(`fleet_apps entry '${job.appName}' deleted`)

  // 3. Delete provision job
  await db.delete(provisionJobs).where(eq(provisionJobs.id, id))
  cleaned.push(`provision_jobs entry '${id}' deleted`)

  return {
    ok: true,
    cleaned,
    message: `Cleanup complete for '${job.appName}'.`,
  }
})
