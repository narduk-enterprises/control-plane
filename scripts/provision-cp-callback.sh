#!/usr/bin/env bash
# Control plane provision callbacks from GitHub Actions (requires curl + jq).
# Env: CONTROL_PLANE_URL, PROVISION_API_KEY, PROVISION_ID
set -euo pipefail

warn() {
  echo "::warning::$*" >&2
}

callback_env_ready() {
  [[ -n "${CONTROL_PLANE_URL:-}" && -n "${PROVISION_API_KEY:-}" && -n "${PROVISION_ID:-}" ]]
}

cp_post() {
  local mode=$1
  local subpath=$2
  local body=$3

  if ! callback_env_ready; then
    warn "Skipping callback ${subpath}: missing CONTROL_PLANE_URL, PROVISION_API_KEY, or PROVISION_ID"
    [[ "$mode" == strict ]] && exit 1
    return 0
  fi

  local url="${CONTROL_PLANE_URL%/}/api/fleet/provision/${PROVISION_ID}/${subpath}"
  local tmp code curl_ec
  tmp=$(mktemp)
  set +e
  code=$(
    curl -sS -w '%{http_code}' -o "$tmp" --max-time 25 \
      --retry 3 --retry-delay 2 --retry-all-errors \
      -X POST "$url" \
      -H "Authorization: Bearer ${PROVISION_API_KEY}" \
      -H 'Content-Type: application/json' \
      -H 'X-Requested-With: XMLHttpRequest' \
      -d "$body"
  )
  curl_ec=$?
  set -e
  if [[ $curl_ec -ne 0 ]]; then
    warn "curl error $curl_ec posting to ${subpath}"
    [[ "$mode" == strict ]] && exit 1
    return 0
  fi
  if [[ "$code" != '200' && "$code" != '201' ]]; then
    warn "Control plane ${subpath} HTTP ${code}: $(head -c 500 "$tmp" | tr -d '\r\n')"
    [[ "$mode" == strict ]] && exit 1
    return 0
  fi
  return 0
}

cmd=${1:?}
case "$cmd" in
  post)
    cp_post "${2:?}" "${3:?}" "${4:?}"
    ;;
  complete-success)
    : "${INPUT_APP_URL:?}" "${INPUT_GITHUB_REPO:?}"
    body=$(
      jq -n \
        --arg status complete \
        --arg deployedUrl "$INPUT_APP_URL" \
        --arg githubRepo "$INPUT_GITHUB_REPO" \
        --arg forgejoRepo "${INPUT_FORGEJO_REPO:-}" \
        --arg repoPrimary github \
        --arg gaPropertyId "${GA_PROPERTY_ID:-}" \
        --arg gaMeasurementId "${GA_MEASUREMENT_ID:-}" \
        '{
          status: $status,
          deployedUrl: $deployedUrl,
          githubRepo: $githubRepo
        }
        + (if $forgejoRepo != "" then {forgejoRepo: $forgejoRepo} else {} end)
        + {repoPrimary: $repoPrimary}
        + (if $gaPropertyId != "" then {gaPropertyId: $gaPropertyId} else {} end)
        + (if $gaMeasurementId != "" then {gaMeasurementId: $gaMeasurementId} else {} end)'
    )
    cp_post strict complete "$body"
    ;;
  complete-failed)
    : "${FAILURE_MESSAGE:?}"
    body=$(
      jq -n \
        --arg status failed \
        --arg errorMessage "$FAILURE_MESSAGE" \
        '{status: $status, errorMessage: $errorMessage}'
    )
    cp_post strict complete "$body"
    ;;
  *)
    echo "usage: $0 post {best-effort|strict} {status|log|complete} JSON_BODY" >&2
    echo "       $0 complete-success" >&2
    echo "       $0 complete-failed" >&2
    exit 1
    ;;
esac
