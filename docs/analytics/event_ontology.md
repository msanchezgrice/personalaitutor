# Analytics Event Ontology

Version: 2026-03-07
Owner: growth / product engineering

## Conventions

- Use `snake_case` event names.
- Prefer action-oriented names: `*_viewed`, `*_clicked`, `*_started`, `*_completed`, `*_failed`.
- Every browser event should include the shared analytics base properties from `apps/web/lib/analytics.ts`.
- Every identified user should be stitched from anonymous to authenticated using PostHog alias + identify.
- Every event that can be attributed to acquisition should include first-touch and last-touch properties.

## Shared Properties

- `app`
- `path`
- `page_url`
- `posthog_distinct_id`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `fbclid`
- `twclid`
- `li_fat_id`
- `gclid`
- `msclkid`
- `landing_path`
- `referrer`
- `attribution_captured_at`
- `first_utm_source`
- `first_utm_medium`
- `first_utm_campaign`
- `first_utm_content`
- `first_utm_term`
- `first_landing_path`
- `first_referrer`
- `paid_source`

## Event Families

### Auth

- `auth_sign_up_page_viewed`
- `auth_sign_in_page_viewed`
- `auth_sign_up_cta_clicked`
- `auth_sign_up_completed`
- `auth_sign_in_completed`
- `auth_sign_out_clicked`
- Legacy compatibility: `auth_clerk_sign_up_viewed`, `auth_clerk_sign_in_viewed`, `clerk_sign_up_completed`, `auth_clerk_sign_up_completed`

### Navigation

- `dashboard_nav_clicked`
- `dashboard_brand_clicked`
- `dashboard_settings_toggled`
- `dashboard_settings_item_clicked`
- `public_profile_clicked`
- `dashboard_home_cta_clicked`
- `projects_cta_clicked`

### Onboarding And Assessment

- `onboarding_viewed`
- `onboarding_step_viewed`
- `onboarding_step_completed`
- `onboarding_step_back_clicked`
- `onboarding_step_validation_failed`
- `onboarding_linkedin_oauth_started`
- `onboarding_linkedin_oauth_completed`
- `onboarding_linkedin_oauth_failed`
- `onboarding_resume_upload_started`
- `onboarding_resume_upload_failed`
- `onboarding_analysis_started`
- `onboarding_analysis_failed`
- `onboarding_assessment_complete`
- `assessment_summary_cta_clicked`
- `onboarding_continue_to_dashboard`
- `onboarding_assessment_funnel_step`

### Dashboard Usage

- `dashboard_tab_viewed`
- `dashboard_welcome_viewed`
- `project_public_link_copy_clicked`
- `project_public_link_copied`
- `project_public_link_copy_failed`

### AI News

- `dashboard_ai_news_story_clicked`
- `ai_news_story_clicked`
- `ai_news_refresh_clicked`
- `ai_news_loaded`
- `ai_news_load_failed`

### Ad / Conversion

- `CompleteRegistration` and `Lead` via Meta Pixel
- Matching server relay events via `/api/analytics/conversion` with shared `eventId`

## Implementation Rules

- Do not overload one event for multiple meanings. Example: page view and form submit must be separate events.
- Track both intent and result when the drop-off matters.
- For async flows, always emit `*_failed` with a `reason`.
- For funnels, prefer explicit step events over inferring step order from page URLs.
- For navigation events, include `location`, `destination`, and a stable semantic label such as `cta`, `tab`, or `item`.
