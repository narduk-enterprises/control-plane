#!/usr/bin/env bash
# Starts `pnpm dev` (web + showcase) and blocks until both ports respond, then
# holds until Playwright tears down this process (trap kills child dev servers).
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

pnpm run dev:kill

# When this script is started under `doppler run` (see playwright-webserver-dev.sh), the env
# already contains hub secrets. Showcase's normal `pnpm dev` runs `doppler run` again, which can
# replace the environment and drop keys not present in the spoke `dev` config — use `dev:app`
# so Nuxt inherits the outer process env (MapKit token route then works in E2E).
# Avoid nested `doppler run` for showcase when env already has MapKit material (see outer script).
if [ -n "${APPLE_SECRET_KEY:-}" ] || [ -n "${MAPKIT_TOKEN:-}" ] || [ -n "${APPLE_MAPKIT_TOKEN:-}" ]; then
  pnpm exec concurrently -n web,showcase -c cyan,blue \
    "pnpm --filter web dev" \
    "pnpm --filter showcase run dev:app" &
else
  pnpm dev &
fi
DEV_PID=$!

HOLD_PID=''
cleanup() {
  if [ -n "${HOLD_PID}" ]; then
    kill "${HOLD_PID}" 2>/dev/null || true
  fi
  kill "${DEV_PID}" 2>/dev/null || true
  wait "${DEV_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

pnpm exec wait-on -t 180000 -i 750 http://127.0.0.1:3000 http://127.0.0.1:3010

tail -f /dev/null &
HOLD_PID=$!
wait "${HOLD_PID}"
