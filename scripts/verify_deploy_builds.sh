#!/usr/bin/env bash
set -euo pipefail

if ! command -v vercel >/dev/null 2>&1; then
  echo "[FAIL] vercel CLI not installed. Install it to run deployment dry-run checks."
  exit 1
fi

pnpm --filter @aitutor/web build
pnpm --filter @aitutor/worker build
vercel build >/dev/null

echo "[PASS] Deployment dry-run checks passed"
