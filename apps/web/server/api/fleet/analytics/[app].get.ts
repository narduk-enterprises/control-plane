import {
  buildFleetAnalyticsSnapshot,
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
  await enforceRateLimit(event, 'fleet-analytics-detail', 20, 60_000)

  const appSlug = parseAnalyticsAppParam(event)
  const query = parseAnalyticsQuery(event)

  try {
    return await buildFleetAnalyticsSnapshot(
      event,
      appSlug,
      { startDate: query.startDate, endDate: query.endDate },
      { force: query.force, mode: 'detail' },
    )
  } catch (error: unknown) {
    throw toHttpError(error)
  }
})
