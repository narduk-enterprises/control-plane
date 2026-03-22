import { getFleetAppByName } from '#server/data/fleet-registry'
import {
  fetchGaEnvelope,
  parseAnalyticsAppParam,
  parseAnalyticsQuery,
  toHttpError,
} from '#server/utils/fleet-analytics'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const cronHeader = getHeader(event, 'x-internal-cron')
  if (!(config.cronSecret && cronHeader === config.cronSecret)) {
    await requireAdmin(event)
  }
  await enforceRateLimit(event, 'fleet-ga', 30, 60_000)

  const appSlug = parseAnalyticsAppParam(event)
  const app = await getFleetAppByName(event, appSlug)
  if (!app) {
    throw createError({ statusCode: 404, message: 'App not found' })
  }

  const query = parseAnalyticsQuery(event)

  try {
    const result = await fetchGaEnvelope(
      event,
      app,
      { startDate: query.startDate, endDate: query.endDate },
      query.force,
    )
    return result.data
  } catch (error: unknown) {
    throw toHttpError(error)
  }
})
