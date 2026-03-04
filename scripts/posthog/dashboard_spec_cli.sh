#!/usr/bin/env bash
set -euo pipefail

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

run_query "Canonical funnel step volumes (last 30d)" "
SELECT
  properties['step'] AS step,
  count() AS events,
  uniq(distinct_id) AS users
FROM events
WHERE event = 'onboarding_assessment_funnel_step'
  AND properties['funnel'] = 'onboarding_assessment'
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY step
ORDER BY events DESC
"

run_query "Clerk sign-up conversion (last 30d)" "
WITH
started AS (
  SELECT uniq(distinct_id) AS users_started
  FROM events
  WHERE event = 'clerk_sign_up_started'
    AND timestamp >= now() - INTERVAL 30 DAY
),
completed AS (
  SELECT uniq(distinct_id) AS users_completed
  FROM events
  WHERE event = 'clerk_sign_up_completed'
    AND timestamp >= now() - INTERVAL 30 DAY
)
SELECT
  started.users_started,
  completed.users_completed,
  if(started.users_started = 0, 0, round(100.0 * completed.users_completed / started.users_started, 2)) AS conversion_percent
FROM started, completed
"

run_query "Onboarding completion rate (last 30d)" "
WITH
viewed AS (
  SELECT uniq(distinct_id) AS users_viewed
  FROM events
  WHERE event = 'onboarding_viewed'
    AND timestamp >= now() - INTERVAL 30 DAY
),
completed AS (
  SELECT uniq(distinct_id) AS users_completed
  FROM events
  WHERE event = 'onboarding_completed'
    AND timestamp >= now() - INTERVAL 30 DAY
)
SELECT
  viewed.users_viewed,
  completed.users_completed,
  if(viewed.users_viewed = 0, 0, round(100.0 * completed.users_completed / viewed.users_viewed, 2)) AS completion_percent
FROM viewed, completed
"

run_query "Assessment completion rate (last 30d)" "
WITH
viewed AS (
  SELECT uniq(distinct_id) AS users_viewed
  FROM events
  WHERE event = 'assessment_viewed'
    AND timestamp >= now() - INTERVAL 30 DAY
),
completed AS (
  SELECT uniq(distinct_id) AS users_completed
  FROM events
  WHERE event = 'assessment_completed'
    AND timestamp >= now() - INTERVAL 30 DAY
)
SELECT
  viewed.users_viewed,
  completed.users_completed,
  if(viewed.users_viewed = 0, 0, round(100.0 * completed.users_completed / viewed.users_viewed, 2)) AS completion_percent
FROM viewed, completed
"

run_query "Failure trend (last 30d)" "
SELECT
  toDate(timestamp) AS day,
  event,
  count() AS errors
FROM events
WHERE event IN ('onboarding_submission_failed', 'assessment_failed', 'assessment_failed_auth_required')
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY day, event
ORDER BY day ASC, event ASC
"

run_query "Resume attach rate breakdown (last 30d)" "
SELECT
  coalesce(properties['resume_extension'], 'unknown') AS resume_extension,
  count() AS attaches,
  uniq(distinct_id) AS users
FROM events
WHERE event = 'onboarding_resume_selected'
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY resume_extension
ORDER BY attaches DESC
"

run_query "Career path impact sample (onboarding -> assessment completed, last 30d)" "
SELECT
  coalesce(properties['career_path_id'], 'unknown') AS career_path_id,
  event,
  uniq(distinct_id) AS users
FROM events
WHERE event IN ('onboarding_viewed', 'assessment_completed')
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY career_path_id, event
ORDER BY career_path_id ASC, event ASC
"

run_query "Goal-count impact (last 30d)" "
SELECT
  toInt64OrZero(coalesce(properties['selected_goals_count'], '0')) AS selected_goals_count,
  count() AS starts,
  uniq(distinct_id) AS users
FROM events
WHERE event = 'onboarding_start_assessment_clicked'
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY selected_goals_count
ORDER BY selected_goals_count ASC
"

run_query "Situation impact on completion (last 30d)" "
SELECT
  coalesce(properties['situation'], 'unknown') AS situation,
  event,
  uniq(distinct_id) AS users
FROM events
WHERE event IN ('onboarding_situation_completed', 'dashboard_welcome_viewed')
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY situation, event
ORDER BY situation ASC, event ASC
"

run_query "Primary goal distribution (last 30d)" "
SELECT
  coalesce(properties['primary_goal'], 'unknown') AS primary_goal,
  count() AS submissions,
  uniq(distinct_id) AS users
FROM events
WHERE event = 'assessment_submitted'
  AND timestamp >= now() - INTERVAL 30 DAY
GROUP BY primary_goal
ORDER BY submissions DESC
"

echo
echo "PostHog dashboard spec checks completed."
