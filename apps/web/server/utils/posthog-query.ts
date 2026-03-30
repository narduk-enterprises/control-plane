interface PosthogEventWhereClauseOptions {
  startISO: string
  endISO: string
  appHost?: string
  internalUsersCohortId?: string | null
  extraClauses?: string[]
}

export const POSTHOG_REQUIRED_INTERNAL_USERS_COHORT_IDS = ['235246'] as const

export const POSTHOG_FALLBACK_INTERNAL_TRAFFIC_CLAUSES = [
  'coalesce(properties.is_internal_user, false) = false',
  'coalesce(properties.is_owner, false) = false',
] as const

function escapeHogqlString(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
}

function normalizePosthogCohortIds(values: Array<string | null | undefined>): string[] {
  const normalizedIds: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    for (const candidate of (value ?? '').split(',')) {
      const trimmed = candidate.trim()
      if (!/^\d+$/.test(trimmed) || seen.has(trimmed)) continue
      seen.add(trimmed)
      normalizedIds.push(trimmed)
    }
  }

  return normalizedIds
}

export function buildPosthogInternalUsersExclusionClauses(
  internalUsersCohortId?: string | null,
): string[] {
  const normalizedCohortIds = normalizePosthogCohortIds([
    internalUsersCohortId,
    ...POSTHOG_REQUIRED_INTERNAL_USERS_COHORT_IDS,
  ])

  return [
    ...normalizedCohortIds.map(
      (cohortId) => `(person_id IS NULL OR person_id NOT IN COHORT ${cohortId})`,
    ),
    ...POSTHOG_FALLBACK_INTERNAL_TRAFFIC_CLAUSES,
  ]
}

export function buildPosthogEventWhereClause({
  startISO,
  endISO,
  appHost,
  internalUsersCohortId,
  extraClauses = [],
}: PosthogEventWhereClauseOptions): string {
  const clauses = [
    `timestamp >= '${escapeHogqlString(startISO)}'`,
    `timestamp <= '${escapeHogqlString(endISO)}'`,
    appHost ? `properties.$host = '${escapeHogqlString(appHost)}'` : null,
    ...buildPosthogInternalUsersExclusionClauses(internalUsersCohortId),
    ...extraClauses,
  ].filter((clause): clause is string => Boolean(clause))

  return `
    WHERE ${clauses.join('\n      AND ')}
  `
}
