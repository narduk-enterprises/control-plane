import { requireAdmin } from '#layer/server/utils/auth'
import { getFleetApps } from '#server/data/fleet-registry'
import { z } from 'zod'
import { withD1Cache } from '#layer/server/utils/d1Cache'


export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const queryParams = await getValidatedQuery(event, z.object({
    force: z.enum(['true', 'false']).optional(),
    includeInactive: z.enum(['true', 'false']).optional(),
  }).parse)

  const cacheKey = queryParams.includeInactive === 'true' ? 'fleet-apps-list-all' : 'fleet-apps-list'
  const TTL = 3600
  const staleWindow = 3600

  return withD1Cache(event, cacheKey, TTL, async () => {
    if (queryParams.includeInactive === 'true') {
      const { getAllFleetApps } = await import('#server/data/fleet-registry')
      return getAllFleetApps(event)
    }
    return getFleetApps(event)
  }, queryParams.force === 'true', { staleWindowSeconds: staleWindow })
})
