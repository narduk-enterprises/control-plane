import { requireAdmin } from '#layer/server/utils/auth'
import { getFleetApps } from '#server/data/fleet-registry'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return getFleetApps()
})
