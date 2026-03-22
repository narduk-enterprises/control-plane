import { z } from 'zod'
import { getFleetAppByName } from '#server/data/fleet-registry'
import {
  fetchPosthogEnvelope,
  parseAnalyticsAppParam,
  toHttpError,
} from '#server/utils/fleet-analytics'

const querySchema = z.object({
  summaryOnly: z.enum(['true', 'false']).optional(),
  force: z.enum(['true', 'false']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const cronHeader = getHeader(event, 'x-internal-cron')
  if (!(config.cronSecret && cronHeader === config.cronSecret)) {
    await requireAdmin(event)
  }
  await enforceRateLimit(event, 'fleet-posthog', 100, 60_000)

  const appSlug = parseAnalyticsAppParam(event)
  const app = await getFleetAppByName(event, appSlug)
  if (!app) {
    throw createError({ statusCode: 404, message: 'App not found' })
  }

  const parsed = querySchema.safeParse(getQuery(event))
  const query = parsed.success ? parsed.data : {}

  try {
    const result = await fetchPosthogEnvelope(event, app, {
      startDate: query.startDate,
      endDate: query.endDate,
      summaryOnly: query.summaryOnly === 'true',
      force: query.force === 'true',
    })
    return result.data
  } catch (error: unknown) {
    throw toHttpError(error)
  }
})
