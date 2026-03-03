# Narduk Control Plane

Fleet dashboard for narduk-enterprises apps: GSC, PostHog, IndexNow, and Google Indexing API.

## Live Site

[https://control-plane.nard.uk](https://control-plane.nard.uk)

## Local Development

1. Set up environment variables (e.g. via Doppler: `doppler setup --project control-plane --config dev`).
2. Run database migration: `pnpm run db:migrate`
3. Start dev server: `pnpm run dev`

## Deployment

Pushes to `main` are automatically built and deployed via GitHub Actions CI (quality then deploy). The worker is served at `control-plane.nard.uk` and the default workers.dev URL.
