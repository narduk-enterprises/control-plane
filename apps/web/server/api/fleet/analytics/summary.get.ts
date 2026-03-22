import {
  buildFleetAnalyticsSummary,
  parseAnalyticsQuery,
  toHttpError,
} from '#server/utils/fleet-analytics'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const cronHeader = getHeader(event, 'x-internal-cron')
  if (!(config.cronSecret && cronHeader === config.cronSecret)) {
    await requireAdmin(event)
  }
  await enforceRateLimit(event, 'fleet-analytics-summary', 20, 60_000)

  const query = parseAnalyticsQuery(event)

  try {
    return await buildFleetAnalyticsSummary(
      event,
      { startDate: query.startDate, endDate: query.endDate },
      query.force,
    )
  } catch (error: unknown) {
    throw toHttpError(error)
  }
})
