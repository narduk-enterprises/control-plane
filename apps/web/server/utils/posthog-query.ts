interface PosthogEventWhereClauseOptions {
  startISO: string
  endISO: string
  appHost?: string
  internalUsersCohortId?: string | null
  extraClauses?: string[]
}

export const POSTHOG_FALLBACK_INTERNAL_TRAFFIC_CLAUSES = [
  'coalesce(properties.is_internal_user, false) = false',
  'coalesce(properties.is_owner, false) = false',
] as const

function escapeHogqlString(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
}

function normalizePosthogCohortId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return /^\d+$/.test(trimmed) ? trimmed : null
}

export function buildPosthogInternalUsersExclusionClauses(
  internalUsersCohortId?: string | null,
): string[] {
  const normalizedCohortId = normalizePosthogCohortId(internalUsersCohortId)
  const clauses: string[] = [...POSTHOG_FALLBACK_INTERNAL_TRAFFIC_CLAUSES]

  if (normalizedCohortId) {
    // Keep anonymous traffic, but exclude identified people who belong to the
    // internal-users cohort.
    clauses.unshift(`(person_id IS NULL OR person_id NOT IN COHORT ${normalizedCohortId})`)
  }

  return clauses
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
