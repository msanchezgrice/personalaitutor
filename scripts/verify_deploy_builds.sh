#!/usr/bin/env bash
set -euo pipefail

if ! command -v vercel >/dev/null 2>&1; then
  echo "[FAIL] vercel CLI not installed. Install it to run deployment dry-run checks."
  exit 1
fi

pnpm --filter @aitutor/web build
pnpm --filter @aitutor/worker build
if ! vercel build >/dev/null; then
  echo "[FAIL] vercel build failed during deployment dry-run verification."
  echo "[INFO] Use pnpm verify:post-push after pushing to main while the local Vercel dry-run issue is investigated."
  exit 1
fi

if [[ "${VERIFY_LIVE_AUTH:-0}" == "1" ]]; then
  echo "[INFO] Running live authenticated dashboard verification"
  bash scripts/verify_post_push_live.sh
else
  echo "[INFO] Skipping live authenticated dashboard verification. Set VERIFY_LIVE_AUTH=1 to enable it."
fi

echo "[PASS] Deployment dry-run checks passed"
