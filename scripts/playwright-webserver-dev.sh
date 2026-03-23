#!/usr/bin/env bash
# Playwright webServer entry: optionally run the inner script under `doppler run`.
#
# If MapKit-related secrets are already in the environment (e.g. you ran
# `doppler run -- pnpm run test:e2e:mapkit`), we must NOT nest `doppler run` when
# `doppler.yaml` exists: that second run loads only the yaml project and can drop
# hub-only keys like APPLE_SECRET_KEY, so /api/mapkit-token returns 503 and the E2E skips.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INNER="${ROOT_DIR}/scripts/_playwright-webserver-dev-inner.sh"
cd "$ROOT_DIR"

mapkit_env_ready() {
  [ -n "${APPLE_SECRET_KEY:-}" ] || [ -n "${MAPKIT_TOKEN:-}" ] || [ -n "${APPLE_MAPKIT_TOKEN:-}" ]
}

if mapkit_env_ready; then
  exec bash "$INNER"
fi

if command -v doppler >/dev/null 2>&1; then
  if [ -f doppler.yaml ]; then
    exec doppler run -- bash "$INNER"
  fi
  if [ -n "${DOPPLER_E2E_PROJECT:-}" ]; then
    exec doppler run --project "$DOPPLER_E2E_PROJECT" --config "${DOPPLER_E2E_CONFIG:-dev}" -- bash "$INNER"
  fi
fi

exec bash "$INNER"
