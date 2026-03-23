#!/usr/bin/env bash
# MapKit Playwright spec: free ports, avoid reusing a stale dev server, and run Playwright under
# Doppler when MapKit secrets exist — try your default `doppler setup` project first, then the
# enterprise hub (`narduk-nuxt-template`) so `pnpm run test:e2e:mapkit` works without `--project`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pnpm run dev:kill
export PW_NO_REUSE_SERVER=1
ARGS=(apps/showcase/tests/e2e/mapkit.spec.ts --project=showcase)

run_playwright() {
  exec pnpm exec playwright test "${ARGS[@]}"
}

if ! command -v doppler >/dev/null 2>&1; then
  run_playwright
fi

if doppler run -- sh -c 'test -n "${APPLE_SECRET_KEY:-}" || test -n "${MAPKIT_TOKEN:-}" || test -n "${APPLE_MAPKIT_TOKEN:-}"'; then
  exec doppler run -- pnpm exec playwright test "${ARGS[@]}"
fi

if doppler run --project narduk-nuxt-template --config dev -- sh -c 'test -n "${APPLE_SECRET_KEY:-}" || test -n "${MAPKIT_TOKEN:-}"'; then
  exec doppler run --project narduk-nuxt-template --config dev -- pnpm exec playwright test "${ARGS[@]}"
fi

run_playwright
