#!/usr/bin/env bash
set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "[FAIL] supabase CLI not installed. Install Supabase CLI to run migration integrity checks."
  exit 1
fi

if [ ! -d "supabase/migrations" ]; then
  echo "[FAIL] supabase/migrations directory missing"
  exit 1
fi

if ! ls supabase/migrations/*.sql >/dev/null 2>&1; then
  echo "[FAIL] no SQL migrations found"
  exit 1
fi

supabase migration list >/dev/null

echo "[PASS] Supabase migration checks passed"
