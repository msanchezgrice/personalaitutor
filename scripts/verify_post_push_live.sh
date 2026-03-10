#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

load_env_file() {
  local env_file="$1"
  if [[ -f "${env_file}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${env_file}"
    set +a
  fi
}

load_env_file ".env"
load_env_file ".env.local"

if [[ -z "${CLERK_SECRET_KEY:-}" ]]; then
  echo "[FAIL] CLERK_SECRET_KEY is required for live authenticated dashboard verification."
  exit 1
fi

if [[ -z "${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}" ]]; then
  echo "[FAIL] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required for live authenticated dashboard verification."
  exit 1
fi

export LIVE_BASE_URL="${LIVE_BASE_URL:-https://www.myaiskilltutor.com}"

INITIAL_WAIT_SECONDS="${POST_PUSH_WAIT_SECONDS:-45}"
POLL_INTERVAL_SECONDS="${POST_PUSH_POLL_INTERVAL_SECONDS:-15}"
TIMEOUT_SECONDS="${POST_PUSH_TIMEOUT_SECONDS:-300}"
READY_PATH="${POST_PUSH_READY_PATH:-/sign-in}"

if (( INITIAL_WAIT_SECONDS > 0 )); then
  echo "[INFO] Waiting ${INITIAL_WAIT_SECONDS}s for deployment propagation at ${LIVE_BASE_URL}"
  sleep "${INITIAL_WAIT_SECONDS}"
fi

echo "[INFO] Checking live endpoint readiness at ${LIVE_BASE_URL}${READY_PATH}"
DEADLINE=$((SECONDS + TIMEOUT_SECONDS))

while true; do
  HTTP_CODE="$(curl -L -sS -o /dev/null -w "%{http_code}" "${LIVE_BASE_URL}${READY_PATH}" || true)"
  case "${HTTP_CODE}" in
    200|204|301|302|307|308)
      echo "[INFO] Live endpoint responded with HTTP ${HTTP_CODE}"
      break
      ;;
  esac

  if (( SECONDS >= DEADLINE )); then
    echo "[FAIL] ${LIVE_BASE_URL}${READY_PATH} did not become ready within ${TIMEOUT_SECONDS}s (last HTTP ${HTTP_CODE:-none})."
    exit 1
  fi

  echo "[INFO] Waiting for live endpoint... last HTTP ${HTTP_CODE:-none}"
  sleep "${POLL_INTERVAL_SECONDS}"
done

pnpm test:e2e:live:auth

echo "[PASS] Live authenticated dashboard verification passed"
