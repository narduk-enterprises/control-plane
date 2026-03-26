import type { AuditCheck } from '#server/utils/fleet-audit'

/**
 * Narduk template apps use D1 name `{fleetAppName}-db`. Warn when both the bare
 * name and `-db` exist (duplicate DBs) or when only the bare name exists.
 */
export function buildFleetD1NamingChecks(
  fleetAppName: string,
  databases: Array<{ name: string }>,
): AuditCheck[] {
  const names = new Set(databases.map((d) => d.name))
  const bare = fleetAppName
  const suffixed = `${fleetAppName}-db`
  const hasBare = names.has(bare)
  const hasSuffixed = names.has(suffixed)

  if (hasBare && hasSuffixed) {
    return [
      {
        name: 'D1 database naming (Cloudflare)',
        status: 'warning',
        expected: `${suffixed} only (narduk template convention)`,
        actual: `${bare}, ${suffixed}`,
        message: `Both "${bare}" and "${suffixed}" exist. The worker usually binds "${suffixed}". Confirm which database holds live data, run migrations against the bound DB, then remove or rename the unused one.`,
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
        message: `Single D1 "${suffixed}" matches the narduk template convention.`,
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
        message: `Only "${bare}" exists; wrangler and CI migrations typically use "${suffixed}". Align database name with wrangler.json or rename so the bound DB matches migrate targets.`,
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
