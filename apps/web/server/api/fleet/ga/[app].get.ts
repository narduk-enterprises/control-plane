import { z } from 'zod'
import { GoogleApiError, googleApiFetch, GA_SCOPES } from '#layer/server/utils/google'
import { getFleetAppByName } from '#server/data/fleet-registry'
import { withD1Cache } from '#layer/server/utils/d1Cache'

const querySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  force: z.enum(['true', 'false']).optional(),
})

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const cronHeader = getHeader(event, 'x-internal-cron')
  if (!(config.cronSecret && cronHeader === config.cronSecret)) {
    await requireAdmin(event)
  }
  await enforceRateLimit(event, 'fleet-ga', 30, 60_000)

  const appSlug = getRouterParam(event, 'app')
  if (!appSlug) throw createError({ statusCode: 400, message: 'Missing app' })

  const app = await getFleetAppByName(event, appSlug)
  if (!app) throw createError({ statusCode: 404, message: 'App not found' })

  // Use per-app property ID from fleet registry
  const propertyId = app.gaPropertyId
  if (!propertyId) {
    throw createError({
      statusCode: 503,
      message: `GA4: No property ID configured for ${app.name}. Add it via the control plane at /fleet/manage.`,
    })
  }

  const parsed = querySchema.safeParse(getQuery(event))
  const query = parsed.success ? parsed.data : {}

  let endDate = (query.endDate ?? new Date().toISOString()).split('T')[0] ?? ''
  let startDate = (query.startDate ?? endDate).split('T')[0] ?? '' // Default: today only

  // Prevent crashes from Vue reactivity rearing when evaluating start before end
  if (startDate > endDate) {
    const temp = startDate
    startDate = endDate
    endDate = temp
  }

  // Calculate previous period for delta comparison
  const startMs = new Date(startDate).getTime()
  const endMs = new Date(endDate).getTime()
  const periodLength = Math.max(86400000, endMs - startMs + 86400000) // Ensure at least 1 day length, inclusive of both bounds

  // The end of the previous period is the day before the start date
  const prevEndMs = startMs - 86400000
  // The start of the previous period goes back the period length from the previous end
  const prevStartMs = prevEndMs - periodLength + 86400000

  const prevStartDate = new Date(prevStartMs).toISOString().split('T')[0] ?? ''
  const prevEndDate = new Date(prevEndMs).toISOString().split('T')[0] ?? ''

  const hostname = new URL(app.url).hostname

  // Determine time dimension: use 'dateHour' for single-day ranges, 'date' for multi-day
  const isSingleDay = startDate === endDate
  const timeDimension = isSingleDay ? 'dateHour' : 'date'

  const cacheKey = `ga-app-${appSlug}-${startDate}-${endDate}`
  const today = new Date().toISOString().split('T')[0] ?? ''
  const isTodayRange = endDate === today
  const TTL = isTodayRange ? 15 * 60 : 6 * 3600
  const staleWindow = isTodayRange ? 15 * 60 : 2 * 3600

  return withD1Cache(
    event,
    cacheKey,
    TTL,
    async () => {
      try {
        const data = (await googleApiFetch(
          `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
          GA_SCOPES,
          {
            method: 'POST',
            body: JSON.stringify({
              dateRanges: [
                { startDate, endDate, name: 'current' },
                { startDate: prevStartDate, endDate: prevEndDate, name: 'previous' },
              ],
              dimensions: [{ name: timeDimension }],
              metrics: [
                { name: 'activeUsers' },
                { name: 'newUsers' },
                { name: 'sessions' },
                { name: 'screenPageViews' },
                { name: 'bounceRate' },
                { name: 'averageSessionDuration' },
                { name: 'engagedSessions' },
                { name: 'engagementRate' },
                { name: 'eventCount' },
              ],
              metricAggregations: ['TOTAL'],
              dimensionFilter: {
                filter: {
                  fieldName: 'hostName',
                  inListFilter: {
                    values: [hostname],
                  },
                },
              },
            }),
          },
        )) as Record<string, unknown>

        const totals = data.totals as Array<{ metricValues?: Array<{ value: string }> }> | undefined
        const rows = data.rows as
          | Array<{
              dimensionValues?: Array<{ value: string }>
              metricValues?: Array<{ value: string }>
            }>
          | undefined

        // Separate current vs previous period rows
        const currentRows = rows?.filter((r) => r.dimensionValues?.[0]?.value !== undefined) ?? []

        // Parse time series (current period only — first dateRange)
        const timeSeries = currentRows
          .filter((row) => {
            // Check if this row belongs to the 'current' dateRange
            // GA Data API groups by dateRange index — current period rows
            // have date values within the requested range
            const dateStr = row.dimensionValues?.[0]?.value ?? ''
            if (isSingleDay) {
              return dateStr.startsWith(startDate.replaceAll('-', ''))
            }
            const cleaned = dateStr.length === 8 ? dateStr : dateStr.replaceAll('-', '')
            const start = startDate.replaceAll('-', '')
            const end = endDate.replaceAll('-', '')
            return cleaned >= start && cleaned <= end
          })
          .map((row) => {
            const dateStr = row.dimensionValues?.[0]?.value ?? ''
            let formattedDate: string
            if (isSingleDay && dateStr.length === 10) {
              // dateHour format: YYYYMMDDHH
              formattedDate = `${dateStr.slice(8, 10)}:00`
            } else if (dateStr.length === 8) {
              formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
            } else {
              formattedDate = dateStr
            }
            return {
              date: formattedDate,
              value: Number(row.metricValues?.[3]?.value ?? 0), // screenPageViews
            }
          })
          .sort((a, b) => a.date.localeCompare(b.date))

        // Build summary from totals (index 0 = current, index 1 = previous)
        const currentTotals = totals?.[0]?.metricValues
        const previousTotals = totals?.[1]?.metricValues

        const summary = currentTotals
          ? {
              activeUsers: Number(currentTotals[0]?.value ?? 0),
              newUsers: Number(currentTotals[1]?.value ?? 0),
              sessions: Number(currentTotals[2]?.value ?? 0),
              screenPageViews: Number(currentTotals[3]?.value ?? 0),
              bounceRate: Number(currentTotals[4]?.value ?? 0),
              averageSessionDuration: Number(currentTotals[5]?.value ?? 0),
              engagedSessions: Number(currentTotals[6]?.value ?? 0),
              engagementRate: Number(currentTotals[7]?.value ?? 0),
              eventCount: Number(currentTotals[8]?.value ?? 0),
            }
          : null

        // Compute deltas (percentage change vs previous period)
        let deltas = null
        if (summary && previousTotals) {
          const prev = {
            activeUsers: Number(previousTotals[0]?.value ?? 0),
            sessions: Number(previousTotals[2]?.value ?? 0),
            screenPageViews: Number(previousTotals[3]?.value ?? 0),
            bounceRate: Number(previousTotals[4]?.value ?? 0),
            averageSessionDuration: Number(previousTotals[5]?.value ?? 0),
            newUsers: Number(previousTotals[1]?.value ?? 0),
          }
          const pctChange = (curr: number, previous: number) =>
            previous === 0 ? (curr > 0 ? 100 : 0) : ((curr - previous) / previous) * 100

          deltas = {
            users: pctChange(summary.activeUsers, prev.activeUsers),
            sessions: pctChange(summary.sessions, prev.sessions),
            pageviews: pctChange(summary.screenPageViews, prev.screenPageViews),
            bounceRate: pctChange(summary.bounceRate, prev.bounceRate),
            avgSessionDuration: pctChange(
              summary.averageSessionDuration,
              prev.averageSessionDuration,
            ),
            newUsers: pctChange(summary.newUsers, prev.newUsers),
          }
        }

        return {
          app: app.name,
          propertyId,
          summary,
          deltas,
          timeSeries,
          startDate,
          endDate,
        }
      } catch (err: unknown) {
        if (err instanceof GoogleApiError) {
          console.error(`[GA4 API Error] ${err.status} ${err.statusText}: ${err.message}`, {
            propertyId,
            app: app.name,
            body: err.body,
          })
          if (err.status === 403) {
            throw createError({
              statusCode: 403,
              message: `GA4: Service account does not have access to property ${propertyId} (${app.name}). Grant analytics-admin@narduk-analytics.iam.gserviceaccount.com Viewer role in GA4 Admin → Property Access Management.`,
              data: err.body,
            })
          }
          throw createError({
            statusCode: err.status,
            message: `GA4 API error: ${err.message}`,
            data: err.body,
          })
        }
        throw createError({
          statusCode: 500,
          message: `GA4 unexpected error: ${(err as Error).message}`,
        })
      }
    },
    query.force === 'true',
    { staleWindowSeconds: staleWindow },
  )
})
