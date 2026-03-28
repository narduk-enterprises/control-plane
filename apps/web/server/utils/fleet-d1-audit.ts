import type { AuditCheck } from '#server/utils/fleet-audit'

/**
 * Validate the expected D1 name for a fleet app when the registry says it uses D1.
 */
export function buildFleetD1NamingChecks(
  app: {
    name: string
    databaseBackend?: 'd1' | 'postgres' | string | null
    d1DatabaseName?: string | null
  },
  databases: Array<{ name: string }>,
): AuditCheck[] {
  if (app.databaseBackend === 'postgres') {
    return [
      {
        name: 'D1 database naming (Cloudflare)',
        status: 'skipped',
        expected: null,
        actual: null,
        message: 'Skipped: fleet registry marks this app as Postgres-backed.',
      },
    ]
  }

  const names = new Set(databases.map((d) => d.name))
  const bare = app.name
  const suffixed = app.d1DatabaseName?.trim() || `${app.name}-db`
  const hasBare = names.has(bare)
  const hasSuffixed = names.has(suffixed)

  if (hasBare && hasSuffixed) {
    return [
      {
        name: 'D1 database naming (Cloudflare)',
        status: 'warning',
        expected: `${suffixed} only (fleet registry target)`,
        actual: `${bare}, ${suffixed}`,
        message: `Both "${bare}" and "${suffixed}" exist. Confirm which database holds live data, run migrations against the bound DB, then remove or rename the unused one.`,
      },
    ]
  }

  if (hasSuffixed && !hasBare) {
    return [
      {
        name: 'D1 database naming (Cloudflare)',
        status: 'pass',
        expected: suffixed,
        actual: suffixed,
        message: `Single D1 "${suffixed}" matches the fleet registry target.`,
      },
    ]
  }

  if (hasBare && !hasSuffixed) {
    return [
      {
        name: 'D1 database naming (Cloudflare)',
        status: 'warning',
        expected: suffixed,
        actual: bare,
        message: `Only "${bare}" exists; the fleet registry expects "${suffixed}". Align the registry metadata or rename so the bound DB matches migrate targets.`,
      },
    ]
  }

  return [
    {
      name: 'D1 database naming (Cloudflare)',
      status: 'skipped',
      expected: suffixed,
      actual: null,
      message: `No "${bare}" or "${suffixed}" in this Cloudflare account (OK if the app has no D1 or uses another database name).`,
    },
  ]
}
