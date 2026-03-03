import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { getFleetAppByName } from '#server/data/fleet-registry'
import { googleApiFetch, GA_SCOPES } from '#layer/server/utils/google'

export default defineEventHandler(async (event) => {
    await requireAdmin(event)
    await enforceRateLimit(event, 'fleet-ga', 30, 60_000)

    const appSlug = getRouterParam(event, 'app')
    if (!appSlug) throw createError({ statusCode: 400, message: 'Missing app' })

    const app = getFleetAppByName(appSlug)
    if (!app) throw createError({ statusCode: 404, message: 'App not found' })

    const config = useRuntimeConfig()
    const propertyId = config.gaPropertyId as string

    if (!propertyId) {
        throw createError({
            statusCode: 503,
            message: 'GA_PROPERTY_ID not configured in runtimeConfig.',
        })
    }

    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - 30)

    const startDate = start.toISOString().split('T')[0] ?? ''
    const endDate = end.toISOString().split('T')[0] ?? ''

    const hostname = new URL(app.url).hostname

    try {
        const data = (await googleApiFetch(
            `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
            GA_SCOPES,
            {
                method: 'POST',
                body: JSON.stringify({
                    dateRanges: [{ startDate, endDate }],
                    metrics: [
                        { name: 'activeUsers' },
                        { name: 'sessions' },
                        { name: 'screenPageViews' },
                        { name: 'bounceRate' },
                        { name: 'averageSessionDuration' },
                    ],
                    dimensionFilter: {
                        filter: {
                            fieldName: 'hostName',
                            inListFilter: {
                                values: [hostname],
                            }
                        }
                    }
                }),
            },
        )) as Record<string, unknown>

        const totals = data.totals as Array<{ metricValues?: Array<{ value: string }> }> | undefined

        // Default correctly if empty
        const summary = totals?.[0]?.metricValues ? {
            activeUsers: Number(totals[0].metricValues[0]?.value ?? 0),
            sessions: Number(totals[0].metricValues[1]?.value ?? 0),
            screenPageViews: Number(totals[0].metricValues[2]?.value ?? 0),
            bounceRate: Number(totals[0].metricValues[3]?.value ?? 0),
            averageSessionDuration: Number(totals[0].metricValues[4]?.value ?? 0),
        } : {
            activeUsers: 0,
            sessions: 0,
            screenPageViews: 0,
            bounceRate: 0,
            averageSessionDuration: 0,
        }

        return {
            app: app.name,
            summary,
            startDate,
            endDate
        }
    } catch (err: unknown) {
        const e = err as { message?: string }
        throw createError({ statusCode: 500, message: `GA4 error: ${e.message ?? 'Unknown'}` })
    }
})
