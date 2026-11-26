#!/usr/bin/env bash
# Serialises CPU/RAM-heavy commands (tsc, full vitest runs, next dev/build) when
# several agents share one small machine. Usage: scripts/heavy.sh pnpm typecheck
set -euo pipefail
exec flock -w 5400 /tmp/remap-heavy.lock "$@"
