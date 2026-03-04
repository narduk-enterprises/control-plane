import { requireAdmin } from '#layer/server/utils/auth'
import { enforceRateLimit } from '#layer/server/utils/rateLimit'
import { getFleetAppByName } from '#server/data/fleet-registry'
import { GoogleApiError, googleApiFetch, GA_SCOPES } from '#layer/server/utils/google'

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
                    dimensions: [
                        { name: 'date' }
                    ],
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
        const rows = data.rows as Array<{ dimensionValues?: Array<{ value: string }>, metricValues?: Array<{ value: string }> }> | undefined

        // Parse time series data
        const timeSeries = rows ? rows.map(row => {
            const dateStr = row.dimensionValues?.[0]?.value ?? ''
            // Format YYYYMMDD to YYYY-MM-DD
            const formattedDate = dateStr.length === 8
                ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
                : dateStr

            return {
                date: formattedDate,
                // Using pageviews generically as the charted metric
                value: Number(row.metricValues?.[2]?.value ?? 0)
            }
        }).sort((a, b) => a.date.localeCompare(b.date)) : []

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
            timeSeries,
            startDate,
            endDate
        }
    } catch (err: unknown) {
        if (err instanceof GoogleApiError) {
            if (err.status === 403) {
                throw createError({
                    statusCode: 403,
                    message: `GA4: Service account does not have access to property ${propertyId}. Grant analytics-admin@narduk-analytics.iam.gserviceaccount.com Viewer role in GA4 Admin → Property Access Management.`,
                    data: err.body
                })
            }
            throw createError({
                statusCode: err.status,
                message: `GA4 API error: ${err.message}`,
                data: err.body
            })
        }
        throw createError({ statusCode: 500, message: `GA4 unexpected error: ${(err as Error).message}` })
    }
})
