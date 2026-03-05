import { requireAdmin } from '#layer/server/utils/auth'
import { getFleetApps } from '#server/data/fleet-registry'
import { z } from 'zod'
import { withD1Cache } from '#server/utils/d1-cache'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const queryParams = await getValidatedQuery(event, z.object({
    force: z.enum(['true', 'false']).optional(),
  }).parse)

  return withD1Cache(event, 'fleet-apps-list', 3600, async () => {
    return getFleetApps()
  }, queryParams.force === 'true')
})
