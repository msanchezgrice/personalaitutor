#!/usr/bin/env bash
set -euo pipefail

TARGETS=("apps/web/app" "apps/web/components" "apps/web/lib")

check_no_match() {
  local pattern="$1"
  local message="$2"
  if rg -n --no-heading -S "$pattern" "${TARGETS[@]}" 2>/dev/null \
    | rg -v 'gemini-static-page\.tsx:.*"/assets/hero\.png": "/assets/interface_macro_mockup\.png"' \
    >/tmp/design_match.out; then
    echo "[FAIL] $message"
    cat /tmp/design_match.out
    exit 1
  fi
}

check_no_match "hero\\.png" "hero.png references remain in production surfaces"
check_no_match "(?i)cryptographically verified" "legacy 'Cryptographically Verified' copy remains"
check_no_match "from-indigo-500|to-purple-600|text-indigo-|text-purple-" "forbidden indigo/purple legacy class patterns remain"

echo "[PASS] Design conformance checks passed"
