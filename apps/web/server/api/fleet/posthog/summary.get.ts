import { fetchPosthogSummaryEnvelope, toHttpError } from '#server/utils/fleet-analytics'
import { getFleetApps } from '#server/data/fleet-registry'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await enforceRateLimit(event, 'fleet-posthog-summary', 30, 60_000)

  const query = await getValidatedQuery(
    event,
    z.object({
      force: z.enum(['true', 'false']).optional(),
    }).parse,
  )

  try {
    const apps = await getFleetApps(event)
    const result = await fetchPosthogSummaryEnvelope(event, apps, query.force === 'true')
    return result.data.apps
  } catch (error: unknown) {
    throw toHttpError(error)
  }
})
