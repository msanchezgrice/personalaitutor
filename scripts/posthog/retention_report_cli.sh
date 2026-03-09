#!/usr/bin/env bash
set -euo pipefail

WINDOW_DAYS="${1:-30}"

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

COHORT_SOURCE_EXPR="coalesce(nullIf(lower(properties['cohort_source']), ''), nullIf(lower(properties['first_utm_source']), ''), nullIf(lower(properties['cohort_paid_source']), ''), 'unknown')"
CAMPAIGN_EXPR="coalesce(nullIf(lower(properties['lifecycle_campaign_key']), ''), nullIf(lower(properties['email_campaign']), ''), nullIf(lower(properties['utm_campaign']), ''), 'unknown')"
WINDOW_EXPR="now() - INTERVAL ${WINDOW_DAYS} DAY"

run_query "Weekly lifecycle email stages by cohort source" "
SELECT
  toStartOfWeek(timestamp) AS week_start,
  ${COHORT_SOURCE_EXPR} AS cohort_source,
  event,
  uniq(distinct_id) AS users
FROM events
WHERE event IN ('email_sent', 'email_delivered', 'email_opened', 'email_clicked')
  AND timestamp >= ${WINDOW_EXPR}
GROUP BY week_start, cohort_source, event
ORDER BY week_start ASC, cohort_source ASC, event ASC
"

run_query "Lifecycle email open and click rates by campaign and source" "
WITH sent AS (
  SELECT
    ${CAMPAIGN_EXPR} AS campaign_key,
    ${COHORT_SOURCE_EXPR} AS cohort_source,
    uniq(distinct_id) AS users_sent
  FROM events
  WHERE event = 'email_sent'
    AND timestamp >= ${WINDOW_EXPR}
  GROUP BY campaign_key, cohort_source
),
opened AS (
  SELECT
    ${CAMPAIGN_EXPR} AS campaign_key,
    ${COHORT_SOURCE_EXPR} AS cohort_source,
    uniq(distinct_id) AS users_opened
  FROM events
  WHERE event = 'email_opened'
    AND timestamp >= ${WINDOW_EXPR}
  GROUP BY campaign_key, cohort_source
),
clicked AS (
  SELECT
    ${CAMPAIGN_EXPR} AS campaign_key,
    ${COHORT_SOURCE_EXPR} AS cohort_source,
    uniq(distinct_id) AS users_clicked
  FROM events
  WHERE event = 'email_clicked'
    AND timestamp >= ${WINDOW_EXPR}
  GROUP BY campaign_key, cohort_source
)
SELECT
  coalesce(sent.campaign_key, opened.campaign_key, clicked.campaign_key) AS campaign_key,
  coalesce(sent.cohort_source, opened.cohort_source, clicked.cohort_source) AS cohort_source,
  coalesce(sent.users_sent, 0) AS users_sent,
  coalesce(opened.users_opened, 0) AS users_opened,
  coalesce(clicked.users_clicked, 0) AS users_clicked,
  if(coalesce(sent.users_sent, 0) = 0, 0, round(100.0 * coalesce(opened.users_opened, 0) / sent.users_sent, 2)) AS open_rate_percent,
  if(coalesce(sent.users_sent, 0) = 0, 0, round(100.0 * coalesce(clicked.users_clicked, 0) / sent.users_sent, 2)) AS click_rate_percent
FROM sent
FULL OUTER JOIN opened
  ON sent.campaign_key = opened.campaign_key
 AND sent.cohort_source = opened.cohort_source
FULL OUTER JOIN clicked
  ON coalesce(sent.campaign_key, opened.campaign_key) = clicked.campaign_key
 AND coalesce(sent.cohort_source, opened.cohort_source) = clicked.cohort_source
ORDER BY campaign_key ASC, click_rate_percent DESC, open_rate_percent DESC
"

run_query "Day 1 next steps performance by cohort source" "
WITH sent AS (
  SELECT
    ${COHORT_SOURCE_EXPR} AS cohort_source,
    uniq(distinct_id) AS users_sent
  FROM events
  WHERE event = 'email_sent'
    AND ${CAMPAIGN_EXPR} = 'day_1_next_steps'
    AND timestamp >= ${WINDOW_EXPR}
  GROUP BY cohort_source
),
opened AS (
  SELECT
    ${COHORT_SOURCE_EXPR} AS cohort_source,
    uniq(distinct_id) AS users_opened
  FROM events
  WHERE event = 'email_opened'
    AND ${CAMPAIGN_EXPR} = 'day_1_next_steps'
    AND timestamp >= ${WINDOW_EXPR}
  GROUP BY cohort_source
),
clicked AS (
  SELECT
    ${COHORT_SOURCE_EXPR} AS cohort_source,
    uniq(distinct_id) AS users_clicked
  FROM events
  WHERE event = 'email_clicked'
    AND ${CAMPAIGN_EXPR} = 'day_1_next_steps'
    AND timestamp >= ${WINDOW_EXPR}
  GROUP BY cohort_source
)
SELECT
  coalesce(sent.cohort_source, opened.cohort_source, clicked.cohort_source) AS cohort_source,
  coalesce(sent.users_sent, 0) AS users_sent,
  coalesce(opened.users_opened, 0) AS users_opened,
  coalesce(clicked.users_clicked, 0) AS users_clicked,
  if(coalesce(sent.users_sent, 0) = 0, 0, round(100.0 * coalesce(opened.users_opened, 0) / sent.users_sent, 2)) AS open_rate_percent,
  if(coalesce(sent.users_sent, 0) = 0, 0, round(100.0 * coalesce(clicked.users_clicked, 0) / sent.users_sent, 2)) AS click_rate_percent
FROM sent
FULL OUTER JOIN opened
  ON sent.cohort_source = opened.cohort_source
FULL OUTER JOIN clicked
  ON coalesce(sent.cohort_source, opened.cohort_source) = clicked.cohort_source
ORDER BY click_rate_percent DESC, open_rate_percent DESC
"

run_query "Email click to return activity within 7 days by source" "
WITH clicked AS (
  SELECT
    distinct_id,
    ${COHORT_SOURCE_EXPR} AS cohort_source,
    min(timestamp) AS clicked_at
  FROM events
  WHERE event = 'email_clicked'
    AND timestamp >= ${WINDOW_EXPR}
  GROUP BY distinct_id, cohort_source
),
returned AS (
  SELECT
    clicked.distinct_id AS distinct_id,
    clicked.cohort_source AS cohort_source,
    min(events.timestamp) AS returned_at
  FROM clicked
  INNER JOIN events
    ON events.distinct_id = clicked.distinct_id
   AND events.timestamp >= clicked.clicked_at
   AND events.timestamp <= clicked.clicked_at + INTERVAL 7 DAY
   AND events.event IN ('dashboard_welcome_viewed', 'dashboard_tab_viewed', 'chat_message_sent', 'projects_cta_clicked')
   AND lower(coalesce(events.properties['utm_source'], '')) = 'lifecycle_email'
  GROUP BY clicked.distinct_id, clicked.cohort_source
)
SELECT
  clicked.cohort_source,
  count() AS clicked_users,
  countIf(returned.returned_at IS NOT NULL) AS returned_users,
  if(count() = 0, 0, round(100.0 * countIf(returned.returned_at IS NOT NULL) / count(), 2)) AS return_rate_percent
FROM clicked
LEFT JOIN returned
  ON clicked.distinct_id = returned.distinct_id
 AND clicked.cohort_source = returned.cohort_source
GROUP BY clicked.cohort_source
ORDER BY return_rate_percent DESC
"

echo
echo "Retention report queries completed (window: ${WINDOW_DAYS} days)."
