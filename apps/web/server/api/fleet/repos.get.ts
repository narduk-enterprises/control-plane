import { requireAdmin } from '#layer/server/utils/auth'
import { getFleetAppIsActiveByName } from '#server/data/fleet-registry'
import { getManagedRepos } from '#server/data/managed-repos'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const query = await getValidatedQuery(
    event,
    z.object({
      syncManaged: z.enum(['true', 'false']).optional(),
      monitoringEnabled: z.enum(['true', 'false']).optional(),
      includeInactive: z.enum(['true', 'false']).optional(),
    }).parse,
  )

  const d1ActiveByName = await getFleetAppIsActiveByName(event)

  return getManagedRepos()
    .map((repo) => ({
      ...repo,
      isActive: d1ActiveByName.get(repo.name) ?? repo.isActive,
    }))
    .filter((repo) => {
      if (query.includeInactive !== 'true' && !repo.isActive) return false
      if (query.syncManaged === 'true' && !repo.syncManaged) return false
      if (query.syncManaged === 'false' && repo.syncManaged) return false
      if (query.monitoringEnabled === 'true' && !repo.monitoringEnabled) return false
      if (query.monitoringEnabled === 'false' && repo.monitoringEnabled) return false
      return true
    })
})
