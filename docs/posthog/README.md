# PostHog Growth Dashboard Specs

## Files
- `funnel_dashboard_spec.json`: concrete dashboard/panel spec keyed to the active onboarding + signup events.
- `dashboard_blueprint.json`: reproducible pinned dashboards, cohorts, and answer-level signup insights.

## CLI query packs
- Funnel sanity checks: `pnpm posthog:dashboard:spec`
- Weekly optimization report by source (`facebook` / `x` / `linkedin`):
  - Default 8-week window: `pnpm posthog:weekly:report`
  - Custom window: `pnpm posthog:weekly:report -- 12`

## Required env
- `POSTHOG_CLI_API_KEY`
- `POSTHOG_CLI_PROJECT_ID`
- Optional: `POSTHOG_CLI_HOST`

## Source normalization used in queries
`coalesce(properties['paid_source'], lower(properties['utm_source']), 'unknown')`

The app now attaches `utm_source`, `utm_medium`, `utm_campaign`, and normalized `paid_source` to the relevant auth/onboarding funnel events.
The app also attaches structured onboarding answer fields such as `career_category_label`, `primary_goal`, `years_experience`, `has_resume`, `has_linkedin_url`, and derived assessment answer props like `answer_ai_comfort`.
