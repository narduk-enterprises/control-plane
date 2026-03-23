import { z } from 'zod'
import { getFleetAppByName } from '#server/data/fleet-registry'
import {
  fetchGscSeriesEnvelope,
  parseAnalyticsAppParam,
  toHttpError,
} from '#server/utils/fleet-analytics'

const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  compareStartDate: z.string().optional(),
  compareEndDate: z.string().optional(),
  force: z.enum(['true', 'false']).optional(),
})

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const cronHeader = getHeader(event, 'x-internal-cron')
  if (!(config.cronSecret && cronHeader === config.cronSecret)) {
    await requireAdmin(event)
  }
  await enforceRateLimit(event, 'fleet-gsc-series', 30, 60_000)

  const appSlug = parseAnalyticsAppParam(event)
  const app = await getFleetAppByName(event, appSlug)
  if (!app) {
    throw createError({ statusCode: 404, message: 'App not found' })
  }

  const parsed = querySchema.safeParse(getQuery(event))
  const query = parsed.success ? parsed.data : {}

  let endDate = (query.endDate ?? new Date().toISOString()).split('T')[0] ?? ''
  const startFallback = new Date(endDate)
  startFallback.setDate(startFallback.getDate() - 30)
  let startDate = (query.startDate ?? startFallback.toISOString()).split('T')[0] ?? ''

  if (startDate > endDate) {
    const temp = startDate
    startDate = endDate
    endDate = temp
  }

  try {
    const result = await fetchGscSeriesEnvelope(
      event,
      app,
      { startDate, endDate },
      query.force === 'true',
    )
    return result.data
  } catch (error: unknown) {
    throw toHttpError(error)
  }
})
