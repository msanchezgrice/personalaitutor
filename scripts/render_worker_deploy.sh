#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${RENDER_API_KEY:-}" ]]; then
  echo "[FAIL] Missing RENDER_API_KEY"
  exit 1
fi

SERVICE_ID="${1:-${RENDER_WORKER_SERVICE_ID:-}}"
if [[ -z "${SERVICE_ID}" ]]; then
  echo "[FAIL] Missing Render worker service id. Pass as arg or set RENDER_WORKER_SERVICE_ID."
  exit 1
fi

echo "[INFO] Triggering Render deploy for service: ${SERVICE_ID}"
HTTP_CODE=$(
  curl -sS -o /tmp/render_worker_deploy.json -w "%{http_code}" \
    -X POST "https://api.render.com/v1/services/${SERVICE_ID}/deploys" \
    -H "Authorization: Bearer ${RENDER_API_KEY}" \
    -H "Content-Type: application/json"
)

if [[ "${HTTP_CODE}" != "201" && "${HTTP_CODE}" != "200" ]]; then
  echo "[FAIL] Render deploy trigger failed (HTTP ${HTTP_CODE})"
  cat /tmp/render_worker_deploy.json
  exit 1
fi

echo "[PASS] Render deploy triggered successfully"
cat /tmp/render_worker_deploy.json
