# AGENTS.md — tools/

These are **Node.js automation scripts** that run locally or in CI. They are
**NOT** deployed to Cloudflare Workers.

> **⚠️ Important:** These scripts use `node:fs`, `node:child_process`, and other
> Node.js built-in modules. This does NOT violate the project's "no Node.js
> modules" constraint — that constraint applies only to `server/` code deployed
> to Workers.

## Scripts

| Script                                | Purpose                                                                                                                                 | Usage                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `provision/*.ts`, `5-hydrate-repo.ts` | Provisioning: D1 (`1-create-d1.ts`), **Workers KV** (`1-create-kv.ts`), Doppler, analytics, **hydrate** writes `wrangler.json` `KV` ids | Invoked from `.github/workflows/provision-app.yml`                             |
| `validate.ts`                         | Confirms infrastructure is correctly provisioned (D1, Doppler, GitHub secrets; includes `CRON_SECRET` for hourly analytics cron)        | `pnpm run validate`                                                            |
| `verify-analytics-cron.ts`            | After deploy: curl `/_cron/fleet-status`, inspect `kv_cache` via remote D1, print `wrangler tail` hint                                  | `pnpm run verify:cron` (Doppler `prd`)                                         |
| `generate-favicons.ts`                | Generates all favicon variants (apple-touch-icon, ico, PNG, webmanifest) from a source SVG                                              | `pnpm generate:favicons`                                                       |
| `setup-analytics.ts`                  | Bootstraps GA4, Google Search Console, and IndexNow                                                                                     | Called from `tools/provision/4-create-analytics.ts` or run directly            |
| `gsc-toolbox.ts`                      | Google Search Console API utilities                                                                                                     | Used by `setup-analytics.ts`                                                   |
| `set-fleet-doppler-urls.ts`           | Bulk-set `SITE_URL` (default) or analytics keys (`--sync-analytics`) across all fleet Doppler projects                                  | `npx tsx tools/set-fleet-doppler-urls.ts [--sync-analytics] [--dry-run]`       |
| `validate-fleet-doppler.ts`           | Verify all fleet apps have required Doppler secrets: `SITE_URL`, `POSTHOG_PUBLIC_KEY`, `POSTHOG_HOST`, `GA_MEASUREMENT_ID`              | `pnpm run check:fleet-doppler`                                                 |
| `fleet-d1.ts`                         | Run remote SQL on a fleet app’s D1 (`{app}-db`) via Cloudflare API; mirrors `POST /api/fleet/apps/:name/d1/query`                       | `pnpm run fleet:d1 -- --app=<name> --command "SELECT 1"` (with `CLOUDFLARE_*`) |
| `fleet-d1-twin-compare.ts`            | Compare `{app}` vs `{app}-db`; `--dry-run` prints migration plan (no writes); `--apps=a,b`; `--print-runbook`                           | `pnpm run fleet:d1:compare -- --apps=a,b --dry-run` (with `CLOUDFLARE_*`)      |
| `fleet-d1-backup.ts`                  | Wrangler `d1 export --remote` for `--app` / `--apps` (bare + `-db`) or `--db-name`; writes `backups/d1/<run-id>/*.sql`                  | `pnpm run fleet:d1:backup -- --apps=austin-texas-net,old-austin-grouch`        |

## vs. `scripts/`

The `scripts/` directory at the repo root contains **shell helper scripts** for
developer convenience (`dev-kill.sh`, `run-dev-auth.sh`). The `tools/` directory
contains **TypeScript automation** for project initialization and
infrastructure.
