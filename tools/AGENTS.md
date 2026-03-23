# AGENTS.md — tools/

These are **Node.js automation scripts** that run locally or in CI. They are
**NOT** deployed to Cloudflare Workers.

> **⚠️ Important:** These scripts use `node:fs`, `node:child_process`, and other
> Node.js built-in modules. This does NOT violate the project's "no Node.js
> modules" constraint — that constraint applies only to `server/` code deployed
> to Workers.

## Scripts

| Script                      | Purpose                                                                                                                          | Usage                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `init.ts`                   | Transforms a fresh template clone into a ready-to-deploy app (renames, provisions D1, Doppler, analytics)                        | `pnpm init -- --name="..." --display="..." --url="..."`                  |
| `validate.ts`               | Confirms infrastructure is correctly provisioned (D1, Doppler, GitHub secrets; includes `CRON_SECRET` for hourly analytics cron) | `pnpm run validate`                                                      |
| `verify-analytics-cron.ts`  | After deploy: curl `/_cron/fleet-status`, inspect `kv_cache` via remote D1, print `wrangler tail` hint                           | `pnpm run verify:cron` (Doppler `prd`)                                   |
| `generate-favicons.ts`      | Generates all favicon variants (apple-touch-icon, ico, PNG, webmanifest) from a source SVG                                       | `pnpm generate:favicons`                                                 |
| `setup-analytics.ts`        | Bootstraps GA4, Google Search Console, and IndexNow                                                                              | Called by `init.ts` or run directly                                      |
| `gsc-toolbox.ts`            | Google Search Console API utilities                                                                                              | Used by `setup-analytics.ts`                                             |
| `set-fleet-doppler-urls.ts` | Bulk-set `SITE_URL` (default) or analytics keys (`--sync-analytics`) across all fleet Doppler projects                           | `npx tsx tools/set-fleet-doppler-urls.ts [--sync-analytics] [--dry-run]` |
| `validate-fleet-doppler.ts` | Verify all fleet apps have required Doppler secrets: `SITE_URL`, `POSTHOG_PUBLIC_KEY`, `POSTHOG_HOST`, `GA_MEASUREMENT_ID`       | `pnpm run check:fleet-doppler`                                           |

## vs. `scripts/`

The `scripts/` directory at the repo root contains **shell helper scripts** for
developer convenience (`dev-kill.sh`, `run-dev-auth.sh`). The `tools/` directory
contains **TypeScript automation** for project initialization and
infrastructure.
