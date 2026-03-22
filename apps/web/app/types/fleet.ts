/**
 * Fleet registry row as stored in the `fleet_apps` D1 table.
 */
export interface FleetRegistryApp {
  name: string
  url: string
  dopplerProject: string
  gaPropertyId?: string | null
  gaMeasurementId?: string | null
  posthogAppName?: string | null
  githubRepo?: string | null
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

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
