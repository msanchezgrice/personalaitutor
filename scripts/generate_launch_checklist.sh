#!/usr/bin/env bash
set -euo pipefail

OUT="docs/launch_checklist.json"
mkdir -p docs

required=(
  OPENAI_API_KEY
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_ANON_KEY
  CLERK_SECRET_KEY
  CLERK_PUBLISHABLE_KEY
  LINKEDIN_CLIENT_ID
  LINKEDIN_CLIENT_SECRET
  LINKEDIN_REDIRECT_URI
  X_CLIENT_ID
  X_CLIENT_SECRET
  X_REDIRECT_URI
  RESEND_API_KEY
  VERCEL_TOKEN
  RENDER_API_KEY
)

{
  echo "{"
  echo "  \"generatedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo "  \"items\": ["

  for i in "${!required[@]}"; do
    key="${required[$i]}"
    if [ -n "${!key-}" ]; then
      status="present"
    else
      status="missing"
    fi

    comma=","
    if [ "$i" -eq "$((${#required[@]} - 1))" ]; then
      comma=""
    fi

    echo "    { \"key\": \"$key\", \"status\": \"$status\" }$comma"
  done

  echo "  ]"
  echo "}"
} > "$OUT"

echo "[INFO] Wrote $OUT"
