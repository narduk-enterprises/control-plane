/**
 * Fleet app status as stored in the `app_status` D1 table.
 * Shared between server endpoints and client components.
 */
export interface FleetAppStatusRecord {
    app: string
    url: string
    status: 'up' | 'down'
    statusCode: number | null
    checkedAt: string
    indexnowLastSubmission: string | null
    indexnowTotalSubmissions: number
    indexnowLastSubmittedCount: number | null
}
