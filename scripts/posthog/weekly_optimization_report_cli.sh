#!/usr/bin/env bash
set -euo pipefail

WEEKS="${1:-8}"

posthog_cmd() {
  if [[ -n "${POSTHOG_CLI_HOST:-}" ]]; then
    npx -y @posthog/cli --host "$POSTHOG_CLI_HOST" "$@"
  else
    npx -y @posthog/cli "$@"
  fi
}

run_query() {
  local label="$1"
  local query="$2"
  echo
  echo "=== ${label} ==="
  posthog_cmd exp query run "$query"
}

if ! posthog_cmd exp query check "SELECT 1" >/dev/null 2>&1; then
  echo "PostHog CLI auth is missing." >&2
  echo "Run: npx -y @posthog/cli login" >&2
  echo "Or set POSTHOG_CLI_API_KEY (phx_...) and POSTHOG_CLI_PROJECT_ID." >&2
  exit 1
fi

SOURCE_EXPR="coalesce(properties['paid_source'], lower(properties['utm_source']), 'unknown')"
WINDOW_EXPR="now() - INTERVAL ${WEEKS} WEEK"

run_query "Weekly acquisition volumes by utm_source (facebook/x/linkedin focus)" "
SELECT
  toStartOfWeek(timestamp) AS week_start,
  ${SOURCE_EXPR} AS paid_source,
  uniq(distinct_id) AS users
FROM events
WHERE event IN ('auth_clerk_sign_up_viewed', 'clerk_sign_up_started', 'onboarding_viewed')
  AND timestamp >= ${WINDOW_EXPR}
GROUP BY week_start, paid_source
ORDER BY week_start ASC, users DESC
"

run_query "Weekly signup conversion by utm_source" "
WITH started AS (
  SELECT
    toStartOfWeek(timestamp) AS week_start,
    ${SOURCE_EXPR} AS paid_source,
    uniq(distinct_id) AS users_started
  FROM events
  WHERE event = 'clerk_sign_up_started'
    AND timestamp >= ${WINDOW_EXPR}
  GROUP BY week_start, paid_source
),
completed AS (
  SELECT
    toStartOfWeek(timestamp) AS week_start,
    ${SOURCE_EXPR} AS paid_source,
    uniq(distinct_id) AS users_completed
  FROM events
  WHERE event = 'clerk_sign_up_completed'
    AND timestamp >= ${WINDOW_EXPR}
  GROUP BY week_start, paid_source
)
SELECT
  coalesce(started.week_start, completed.week_start) AS week_start,
  coalesce(started.paid_source, completed.paid_source) AS paid_source,
  coalesce(started.users_started, 0) AS users_started,
  coalesce(completed.users_completed, 0) AS users_completed,
  if(coalesce(started.users_started, 0) = 0, 0, round(100.0 * coalesce(completed.users_completed, 0) / started.users_started, 2)) AS signup_cvr_percent
FROM started
FULL OUTER JOIN completed
  ON started.week_start = completed.week_start
 AND started.paid_source = completed.paid_source
ORDER BY week_start ASC, signup_cvr_percent DESC
"

run_query "Weekly onboarding completion by utm_source" "
WITH viewed AS (
  SELECT
    toStartOfWeek(timestamp) AS week_start,
    ${SOURCE_EXPR} AS paid_source,
    uniq(distinct_id) AS users_viewed
  FROM events
  WHERE event IN ('onboarding_viewed', 'onboarding_step_viewed')
    AND timestamp >= ${WINDOW_EXPR}
  GROUP BY week_start, paid_source
),
completed AS (
  SELECT
    toStartOfWeek(timestamp) AS week_start,
    ${SOURCE_EXPR} AS paid_source,
    uniq(distinct_id) AS users_completed
  FROM events
  WHERE event IN ('onboarding_assessment_complete', 'onboarding_completed')
    AND timestamp >= ${WINDOW_EXPR}
  GROUP BY week_start, paid_source
)
SELECT
  coalesce(viewed.week_start, completed.week_start) AS week_start,
  coalesce(viewed.paid_source, completed.paid_source) AS paid_source,
  coalesce(viewed.users_viewed, 0) AS users_viewed,
  coalesce(completed.users_completed, 0) AS users_completed,
  if(coalesce(viewed.users_viewed, 0) = 0, 0, round(100.0 * coalesce(completed.users_completed, 0) / viewed.users_viewed, 2)) AS onboarding_cvr_percent
FROM viewed
FULL OUTER JOIN completed
  ON viewed.week_start = completed.week_start
 AND viewed.paid_source = completed.paid_source
ORDER BY week_start ASC, onboarding_cvr_percent DESC
"

run_query "Weekly activation rate (assessment complete -> dashboard welcome) by utm_source" "
WITH completed AS (
  SELECT
    toStartOfWeek(timestamp) AS week_start,
    ${SOURCE_EXPR} AS paid_source,
    uniq(distinct_id) AS users_completed
  FROM events
  WHERE event IN ('onboarding_assessment_complete', 'onboarding_completed')
    AND timestamp >= ${WINDOW_EXPR}
  GROUP BY week_start, paid_source
),
welcomed AS (
  SELECT
    toStartOfWeek(timestamp) AS week_start,
    ${SOURCE_EXPR} AS paid_source,
    uniq(distinct_id) AS users_welcomed
  FROM events
  WHERE event = 'dashboard_welcome_viewed'
    AND timestamp >= ${WINDOW_EXPR}
  GROUP BY week_start, paid_source
)
SELECT
  coalesce(completed.week_start, welcomed.week_start) AS week_start,
  coalesce(completed.paid_source, welcomed.paid_source) AS paid_source,
  coalesce(completed.users_completed, 0) AS users_completed,
  coalesce(welcomed.users_welcomed, 0) AS users_welcomed,
  if(coalesce(completed.users_completed, 0) = 0, 0, round(100.0 * coalesce(welcomed.users_welcomed, 0) / completed.users_completed, 2)) AS activation_percent
FROM completed
FULL OUTER JOIN welcomed
  ON completed.week_start = welcomed.week_start
 AND completed.paid_source = welcomed.paid_source
ORDER BY week_start ASC, activation_percent DESC
"

run_query "Weekly top dropoff step by utm_source" "
SELECT
  toStartOfWeek(timestamp) AS week_start,
  ${SOURCE_EXPR} AS paid_source,
  coalesce(properties['step_name'], properties['step'], properties['funnel_step'], 'n/a') AS funnel_step,
  uniq(distinct_id) AS users
FROM events
WHERE event IN ('onboarding_step_viewed', 'onboarding_step_completed', 'onboarding_assessment_funnel_step')
  AND timestamp >= ${WINDOW_EXPR}
GROUP BY week_start, paid_source, funnel_step
ORDER BY week_start ASC, paid_source ASC, users DESC
"

echo
echo "Weekly optimization report queries completed (window: ${WEEKS} weeks)."
