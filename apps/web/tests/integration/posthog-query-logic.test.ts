import { describe, expect, it } from 'vitest'
import {
  buildPosthogEventWhereClause,
  buildPosthogInternalUsersExclusionClauses,
  POSTHOG_FALLBACK_INTERNAL_TRAFFIC_CLAUSES,
  POSTHOG_REQUIRED_INTERNAL_USERS_COHORT_IDS,
} from '../../server/utils/posthog-query'

describe('posthog query helpers', () => {
  it('filters the internal-users cohort from host-scoped analytics queries', () => {
    const whereClause = buildPosthogEventWhereClause({
      startISO: '2026-03-01T00:00:00',
      endISO: '2026-03-02T23:59:59',
      appHost: 'control-plane.narduk.com',
      internalUsersCohortId: '225374',
    })

    expect(whereClause).toContain("timestamp >= '2026-03-01T00:00:00'")
    expect(whereClause).toContain("timestamp <= '2026-03-02T23:59:59'")
    expect(whereClause).toContain("properties.$host = 'control-plane.narduk.com'")
    expect(whereClause).toContain('(person_id IS NULL OR person_id NOT IN COHORT 225374)')
    expect(whereClause).toContain('(person_id IS NULL OR person_id NOT IN COHORT 235246)')
  })

  it('supports shared summary filters without requiring a host clause', () => {
    const whereClause = buildPosthogEventWhereClause({
      startISO: '2026-03-01T00:00:00',
      endISO: '2026-03-02T23:59:59',
      extraClauses: ["event = '$pageview'"],
    })

    expect(whereClause).toContain("event = '$pageview'")
    expect(whereClause).not.toContain('properties.$host =')
  })

  it('keeps property-based fallbacks alongside the cohort filter', () => {
    const clauses = buildPosthogInternalUsersExclusionClauses('225374')

    expect(clauses).toEqual([
      '(person_id IS NULL OR person_id NOT IN COHORT 225374)',
      '(person_id IS NULL OR person_id NOT IN COHORT 235246)',
      ...POSTHOG_FALLBACK_INTERNAL_TRAFFIC_CLAUSES,
    ])
  })

  it('deduplicates configured cohort IDs against required internal cohorts', () => {
    const clauses = buildPosthogInternalUsersExclusionClauses('225374, 235246')

    expect(clauses).toEqual([
      '(person_id IS NULL OR person_id NOT IN COHORT 225374)',
      ...POSTHOG_REQUIRED_INTERNAL_USERS_COHORT_IDS.map(
        (cohortId) => `(person_id IS NULL OR person_id NOT IN COHORT ${cohortId})`,
      ),
      ...POSTHOG_FALLBACK_INTERNAL_TRAFFIC_CLAUSES,
    ])
  })
})
