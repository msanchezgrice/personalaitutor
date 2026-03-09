# PostHog Growth Dashboard Specs

## Files
- `../analytics/clerk_analytics_rollout.md`: reusable end-to-end rollout standard for Clerk + PostHog + Meta + Resend projects.
- `funnel_dashboard_spec.json`: concrete dashboard/panel spec keyed to the active onboarding + signup events.
- `retention_funnel_spec.json`: lifecycle email send/open/click/return tables broken down by cohort source and email campaign.
- `dashboard_blueprint.json`: reproducible pinned dashboards, cohorts, and answer-level signup insights.

## CLI query packs
- Funnel sanity checks: `pnpm posthog:dashboard:spec`
- Weekly optimization report by source (`facebook` / `x` / `linkedin`):
  - Default 8-week window: `pnpm posthog:weekly:report`
  - Custom window: `pnpm posthog:weekly:report -- 12`
- Retention tables by cohort source and lifecycle email campaign:
  - Default 30-day window: `pnpm posthog:retention:report`
  - Custom window: `pnpm posthog:retention:report -- 60`

## Required env
- `POSTHOG_CLI_API_KEY`
- `POSTHOG_CLI_PROJECT_ID`
- Optional: `POSTHOG_CLI_HOST`

## Source normalization used in queries
`coalesce(properties['paid_source'], lower(properties['utm_source']), 'unknown')`

The app now attaches `utm_source`, `utm_medium`, `utm_campaign`, and normalized `paid_source` to the relevant auth/onboarding funnel events.
The app also attaches structured onboarding answer fields such as `career_category_label`, `primary_goal`, `years_experience`, `has_resume`, `has_linkedin_url`, and derived assessment answer props like `answer_ai_comfort`.
Lifecycle email events now add `cohort_source`, `cohort_paid_source`, `lifecycle_campaign_key`, and email-side `utm_*` props so day-1 and week-1 retention can be queried by original acquisition source and by lifecycle email traffic source.
