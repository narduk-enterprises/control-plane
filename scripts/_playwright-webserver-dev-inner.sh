#!/usr/bin/env bash
# Starts `pnpm dev` and blocks until the configured web port responds, then
# holds until Playwright tears down this process (trap kills child dev server).
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
WEB_PORT="${NUXT_PORT:-3000}"

pnpm run dev:kill
pnpm dev &
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

pnpm exec wait-on -t 180000 -i 750 "http://127.0.0.1:${WEB_PORT}"

tail -f /dev/null &
HOLD_PID=$!
wait "${HOLD_PID}"
