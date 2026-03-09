# Clerk Analytics Rollout Playbook

Version: 2026-03-09
Owner: growth / product engineering
Scope: reusable implementation standard for Clerk + PostHog + Meta Pixel/CAPI + Resend lifecycle email analytics

## Purpose

This document defines the analytics, attribution, conversion, and retention stack that should exist in every Clerk-based project.

Use it for:

- new product launches
- landing-page templates that use Clerk for auth
- full-product apps with onboarding and activation flows
- retrofitting older Clerk apps that only track top-of-funnel page views

This playbook is based on the implementation in this repo and is meant to be reused across other Clerk projects with minimal changes.

## Outcomes Required

Every project should support all of the following:

- full acquisition-to-signup funnel visibility
- first-touch and last-touch source attribution
- anonymous to authenticated journey stitching
- Meta Pixel and CAPI conversion tracking with deduplication
- full core-product action visibility
- lifecycle email send/open/click/bounce/unsubscribe tracking
- retention reporting by original signup source
- return-traffic reporting from lifecycle email traffic
- documented event ontology
- reproducible dashboard specs and query outputs

## Minimum Stack

Every Clerk project should have these systems:

- Clerk for auth
- PostHog for product analytics
- Meta Pixel in browser
- Meta Conversions API relay on server
- Resend for lifecycle email sends
- Resend webhook ingestion for email engagement events
- persistent acquisition attribution store

## Canonical Architecture

### 1. Client Analytics Layer

Add one browser analytics module that does all of the following:

- wraps `posthog.capture`
- wraps `posthog.identify`
- wraps `posthog.alias`
- exposes `reset` for sign-out
- appends shared event properties to every event
- reads attribution from browser storage

Expected responsibilities:

- shared props:
  - `app`
  - `path`
  - `page_url`
  - `posthog_distinct_id`
  - `utm_*`
  - click IDs
  - `landing_path`
  - `referrer`
  - `first_*`
  - normalized `paid_source`
- identity stitching on auth completion
- person property updates on identify

Reference implementation:

- [apps/web/lib/analytics.ts](/Users/miguel/PersonalAITutor/apps/web/lib/analytics.ts)

### 2. Attribution Capture Layer

Before auth, persist first-touch and last-touch attribution in browser storage and cookie.

Required fields:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `fbclid`
- `gclid`
- `msclkid`
- `twclid`
- `li_fat_id`
- `landing_path`
- `referrer`
- `captured_at`

Required behaviors:

- first-touch should only be written once
- last-touch should update on every new attributable session
- both should survive through auth completion
- both should be attached to browser events and identified people

Reference implementation:

- [apps/web/lib/attribution.ts](/Users/miguel/PersonalAITutor/apps/web/lib/attribution.ts)

### 3. Clerk Auth Instrumentation

Do not treat Clerk as a black box.

Track:

- `auth_sign_up_page_viewed`
- `auth_sign_in_page_viewed`
- `auth_sign_up_cta_clicked`
- `auth_sign_up_completed`
- `auth_sign_in_completed`
- `auth_sign_out_clicked`

Auth rules:

- use Clerk `userId` as the canonical identified PostHog user ID
- on first successful auth, call:
  - `posthog.alias(clerkUserId, anonymousDistinctId)`
  - `posthog.identify(clerkUserId, personProps)`
- set person properties:
  - `email`
  - `name`
  - `handle`
  - `auth_provider=clerk`
  - first-touch attribution
  - last-touch attribution

Do not:

- use one event name for both page view and auth completion
- delay identify until deep inside the app
- lose anonymous journey history across sign-up

Reference implementation:

- [apps/web/components/auth-page-tracking.tsx](/Users/miguel/PersonalAITutor/apps/web/components/auth-page-tracking.tsx)
- [apps/web/components/auth-completion-tracker.tsx](/Users/miguel/PersonalAITutor/apps/web/components/auth-completion-tracker.tsx)

### 4. Meta Pixel And CAPI

Meta tracking must support both browser and server events with shared dedup keys.

Required conversions:

- `CompleteRegistration`
- `Lead`

Requirements:

- browser pixel fires with `eventID`
- server relay fires matching CAPI event with same `event_id`
- include `source_url`
- include `_fbp` and `_fbc` when available
- preserve attribution source for reporting

Do not:

- fire browser and server conversions with different IDs
- rely only on browser pixel for critical conversions

Reference implementation:

- [apps/web/lib/ad-conversions.ts](/Users/miguel/PersonalAITutor/apps/web/lib/ad-conversions.ts)
- [apps/web/lib/fb-pixel.ts](/Users/miguel/PersonalAITutor/apps/web/lib/fb-pixel.ts)
- [apps/web/app/api/analytics/conversion/route.ts](/Users/miguel/PersonalAITutor/apps/web/app/api/analytics/conversion/route.ts)

### 5. Core Product Event Tracking

Every meaningful user action should emit a documented event.

Use these action suffixes:

- `*_viewed`
- `*_clicked`
- `*_started`
- `*_completed`
- `*_failed`

For all product apps, instrument:

- navigation clicks
- settings/menu actions
- onboarding steps
- validation failures
- async failures
- first-value actions
- repeated core actions
- share/publish/copy actions

Implementation rule:

- separate user intent from result
- separate success from failure
- include stable semantic props such as `location`, `destination`, `tab`, `item`, `cta`, `step_name`, `reason`

Reference ontology:

- [docs/analytics/event_ontology.md](/Users/miguel/PersonalAITutor/docs/analytics/event_ontology.md)

### 6. Server-Side PostHog Capture

Any authoritative or async event should also be capturable server-side.

Examples:

- onboarding completion
- async processing failures
- webhooks
- background jobs
- lifecycle email sends
- email opens/clicks

Required helper:

- one server capture utility that posts to PostHog `/capture/`

Reference implementation:

- [packages/shared/src/posthog.ts](/Users/miguel/PersonalAITutor/packages/shared/src/posthog.ts)

### 7. Resend Lifecycle Email Analytics

Lifecycle email analytics should not stop at send success.

Persist two layers:

- `learner_email_deliveries`
  - one row per lifecycle send
  - stores provider message id and source snapshot
- `learner_email_events`
  - one row per webhook event
  - stores delivered/opened/clicked/bounced/complained/unsubscribed

Required fields on delivery rows:

- `delivery_id`
- `campaign_key`
- `provider`
- `provider_message_id`
- `recipient_email`
- original acquisition cohort fields:
  - `cohort_source`
  - `cohort_medium`
  - `cohort_campaign`
  - `cohort_paid_source`

Required fields on event rows:

- `delivery_id`
- `provider_event_id`
- `provider_message_id`
- `event_type`
- `event_at`
- `link_url`
- `link_host`
- `link_path`
- same cohort fields as delivery
- raw payload

Required behaviors:

- verify webhook signature using `RESEND_WEBHOOK_SECRET`
- map webhook events into canonical PostHog events:
  - `email_sent`
  - `email_delivered`
  - `email_opened`
  - `email_clicked`
  - `email_bounced`
  - `email_complained`
  - `email_unsubscribed`

Reference implementation:

- [supabase/migrations/20260308143000_add_lifecycle_email_events.sql](/Users/miguel/PersonalAITutor/supabase/migrations/20260308143000_add_lifecycle_email_events.sql)
- [apps/worker/src/index.ts](/Users/miguel/PersonalAITutor/apps/worker/src/index.ts)
- [apps/web/app/api/email/resend/webhook/route.ts](/Users/miguel/PersonalAITutor/apps/web/app/api/email/resend/webhook/route.ts)

### 8. Email Link Tracking

All lifecycle email links must be tagged so return traffic is attributable.

Required link params:

- `utm_source=lifecycle_email`
- `utm_medium=email`
- `utm_campaign=<campaign_key>`
- `utm_content=<cta_name>`
- `email_delivery_id=<delivery_id>`
- `email_campaign_key=<campaign_key>`
- `email_cta=<cta_name>`

Important distinction:

- `utm_source=lifecycle_email` tells you the session returned from email
- `cohort_source` tells you where the user originally came from before signup

You need both.

Reference implementation:

- [packages/shared/src/email-tracking.ts](/Users/miguel/PersonalAITutor/packages/shared/src/email-tracking.ts)
- [packages/shared/src/lifecycle-email.ts](/Users/miguel/PersonalAITutor/packages/shared/src/lifecycle-email.ts)

## Canonical Shared Properties

Every browser event should include:

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
- `gclid`
- `msclkid`
- `twclid`
- `li_fat_id`
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

Every lifecycle email event should also include:

- `lifecycle_delivery_id`
- `lifecycle_campaign_key`
- `email_provider`
- `provider_message_id`
- `cohort_source`
- `cohort_medium`
- `cohort_campaign`
- `cohort_paid_source`

## Canonical Event Families

### Auth

- `auth_sign_up_page_viewed`
- `auth_sign_in_page_viewed`
- `auth_sign_up_cta_clicked`
- `auth_sign_up_completed`
- `auth_sign_in_completed`
- `auth_sign_out_clicked`

### Landing / Acquisition

- `landing_page_viewed`
- `hero_cta_clicked`
- `pricing_cta_clicked`
- `footer_cta_clicked`
- `contact_cta_clicked`

### Onboarding / Activation

- `onboarding_viewed`
- `onboarding_step_viewed`
- `onboarding_step_completed`
- `onboarding_step_back_clicked`
- `onboarding_step_validation_failed`
- `onboarding_async_failed`
- `activation_complete`

### Product Usage

- `dashboard_tab_viewed`
- `nav_clicked`
- `settings_item_clicked`
- `core_action_started`
- `core_action_completed`
- `core_action_failed`

### Email / Retention

- `email_sent`
- `email_delivered`
- `email_opened`
- `email_clicked`
- `email_bounced`
- `email_complained`
- `email_unsubscribed`

## Dashboard Standard

Every Clerk app should define all of the following dashboards or query packs.

### 1. Acquisition Funnel

Definition:

- landing page view
- primary CTA click
- sign-up page view
- sign-up complete

Breakdowns:

- `paid_source`
- `utm_source`
- `utm_campaign`
- `utm_content`

Outputs:

- signup CVR by source
- signup CVR by campaign
- weekly trend by source

### 2. Auth Funnel

Definition:

- sign-up page viewed
- sign-up CTA clicked
- auth completed

Outputs:

- auth drop-off
- provider mix
- auth completion lag

### 3. Onboarding Funnel

Definition:

- onboarding viewed
- each onboarding step viewed/completed
- onboarding complete

Outputs:

- completion rate by step
- step back rate
- validation failure rate
- async failure reasons
- completion by source

### 4. Activation Funnel

Definition:

- sign-up complete
- onboarding complete
- first dashboard value
- first core action

Outputs:

- time to first value
- activation by source
- activation by campaign

### 5. Traffic By Source

Definition:

- users/sessions/events by source and campaign

Outputs:

- top sources
- top campaigns
- quality by downstream conversion

### 6. Core Product Usage

Definition:

- first and repeat usage of main product actions

Outputs:

- DAU / WAU
- repeat usage rate
- feature adoption rate
- frequency of core actions

### 7. Lifecycle Email Performance

Definition:

- `email_sent`
- `email_delivered`
- `email_opened`
- `email_clicked`
- `email_bounced`
- `email_unsubscribed`

Breakdowns:

- `lifecycle_campaign_key`
- `cohort_source`
- `cohort_paid_source`

Outputs:

- open rate
- click rate
- unsubscribe rate
- bounce rate
- campaign performance by acquisition cohort

### 8. Retention By Signup Source

Definition:

- cohort retention using original acquisition source, not current session source

Breakdowns:

- `cohort_source`
- `cohort_campaign`
- `cohort_paid_source`

Outputs:

- D1 retention
- D7 retention
- D14 retention
- D30 retention

### 9. Email Return Funnel

Definition:

- `email_clicked`
- returned session from lifecycle email
- core action within seven days

Outputs:

- return rate by email campaign
- return rate by original signup source
- email reactivation quality

### 10. Weekly Operator Report

Outputs:

- source mix changes
- funnel breakage alerts
- top onboarding drop-offs
- async failure spikes
- email performance by source
- retention changes by signup source

## Reporting Outputs To Standardize

Each project should provide these outputs in either PostHog dashboards, CLI reports, or saved SQL/HogQL.

- weekly acquisition by source
- weekly signup conversion by source
- weekly onboarding conversion by source
- weekly activation rate by source
- step diagnostics by source
- async failure table
- lifecycle email stage volumes by source
- lifecycle email open/click rates by source
- lifecycle email open/click rates by campaign
- D1/D7 retention by signup source
- email click to core-action return rate by signup source

Reference specs:

- [docs/posthog/funnel_dashboard_spec.json](/Users/miguel/PersonalAITutor/docs/posthog/funnel_dashboard_spec.json)
- [docs/posthog/retention_funnel_spec.json](/Users/miguel/PersonalAITutor/docs/posthog/retention_funnel_spec.json)
- [scripts/posthog/dashboard_spec_cli.sh](/Users/miguel/PersonalAITutor/scripts/posthog/dashboard_spec_cli.sh)
- [scripts/posthog/weekly_optimization_report_cli.sh](/Users/miguel/PersonalAITutor/scripts/posthog/weekly_optimization_report_cli.sh)
- [scripts/posthog/retention_report_cli.sh](/Users/miguel/PersonalAITutor/scripts/posthog/retention_report_cli.sh)

## Env Vars Required

Required or recommended:

- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `POSTHOG_PROJECT_API_KEY`
- `META_PIXEL_ID`
- `NEXT_PUBLIC_FB_PIXEL_ID`
- `META_CONVERSIONS_ACCESS_TOKEN`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `POSTHOG_CLI_API_KEY`
- `POSTHOG_CLI_PROJECT_ID`
- optional: `POSTHOG_CLI_HOST`

Reference:

- [docs/env_variables_instructions.md](/Users/miguel/PersonalAITutor/docs/env_variables_instructions.md)

## Storage Standard

If the app stores onboarding or signup state, define a source-of-truth map.

At minimum document:

- where auth identity is persisted
- where acquisition is persisted
- where onboarding draft / completion state is persisted
- where email delivery state is persisted
- where email engagement state is persisted
- what is and is not copied to PostHog

Reference:

- [docs/data/signup_input_storage_map.md](/Users/miguel/PersonalAITutor/docs/data/signup_input_storage_map.md)

## Landing Template Vs Full Product

### Landing Template Apps

Usually already have:

- page views
- CTA clicks
- Clerk auth
- maybe Meta browser pixel

Still missing in most cases:

- anonymous to identified stitching
- first-touch and last-touch persistence
- server-side Meta dedup
- server-side PostHog capture
- lifecycle email tracking
- retention by signup source

### Full Product Apps

Must additionally track:

- onboarding step diagnostics
- validation failures
- async failures
- core usage events
- repeat activity
- lifecycle email engagement
- source-based retention

## Reboot / Landing-Template Overlap

If your other project already has a visibility push similar to Reboot or a landing-page template, assume it likely overlaps on:

- page view tracking
- hero CTA tracking
- source attribution basics
- Clerk sign-up completion
- Meta Pixel basics

Assume it still needs the following unless confirmed otherwise:

- PostHog alias and identify stitching
- first-touch and last-touch storage
- canonical event ontology
- strict separation of viewed / clicked / completed / failed
- server-side conversion relay
- server-side PostHog capture
- Resend webhook ingestion
- email event tables
- retention by original signup source

## Rollout Sequence

Apply in this order:

1. bootstrap PostHog client and attribution capture
2. instrument Clerk auth page views and completions
3. add alias + identify stitching
4. add Meta Pixel + CAPI dedup
5. instrument onboarding and activation funnel
6. instrument core product actions
7. add server capture helper
8. add lifecycle email send tracking
9. add Resend webhook ingestion
10. add retention dashboards and CLI reports
11. document ontology, storage, env vars, dashboards
12. run verification

## Verification Checklist

Verify all of the following:

- typecheck passes
- migration verification passes
- auth page view events fire
- auth completion events fire
- anonymous user is aliased to Clerk user
- Meta browser and server events share event ID
- onboarding step events fire with correct props
- first value events fire
- lifecycle email links contain tracked params
- Resend webhook can insert email engagement events
- PostHog receives server-side email events
- dashboard queries return expected columns

## Canonical LLM Prompts

### Implementation Prompt

```text
Implement a production-grade analytics, attribution, conversion, and retention stack for this Clerk-based app.

Requirements:
1. Add a shared PostHog client wrapper for capture, identify, alias, reset, and shared event properties.
2. Persist first-touch and last-touch attribution using utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid, msclkid, twclid, li_fat_id, landing_path, referrer.
3. Normalize paid_source into facebook, google, linkedin, x, bing, unknown.
4. Track Clerk auth events:
   - auth_sign_up_page_viewed
   - auth_sign_in_page_viewed
   - auth_sign_up_cta_clicked
   - auth_sign_up_completed
   - auth_sign_in_completed
   - auth_sign_out_clicked
5. Alias anonymous PostHog activity to Clerk userId on first auth success and set person properties.
6. Add Meta Pixel plus server-side CAPI relay with shared eventId dedup for CompleteRegistration and Lead.
7. Instrument all major user actions using explicit viewed, clicked, started, completed, failed events.
8. Add server-side PostHog capture for backend, worker, and webhook events.
9. Add Resend lifecycle email analytics:
   - send-level delivery table
   - event-level webhook table
   - webhook signature verification
   - PostHog email_sent/email_opened/email_clicked/etc capture
10. Tag every lifecycle email CTA with utm_source=lifecycle_email, utm_medium=email, utm_campaign=<campaign_key>, utm_content=<cta_name>, plus delivery correlation params.
11. Define dashboard specs and query outputs for acquisition, onboarding, activation, source mix, lifecycle email performance, and retention by signup source.
12. Document event ontology, env vars, storage map, and remaining live-config steps.

Constraints:
- use snake_case event names
- do not overload event names
- separate page views from completions
- separate intent from result
- keep legacy aliases only if required for backwards compatibility
- verify with typecheck/tests before finalizing
```

### Audit Prompt

```text
Audit this Clerk app’s analytics and attribution stack for full visibility from landing page through retention.

Check:
- Clerk auth instrumentation
- anonymous-to-identified stitching
- first-touch and last-touch attribution completeness
- Meta Pixel and CAPI dedup
- PostHog event ontology quality
- onboarding funnel coverage
- core product action coverage
- lifecycle email tracking
- retention by original signup source
- reporting/dashboard completeness

Output:
1. missing events
2. broken semantics
3. attribution gaps
4. identity stitching gaps
5. lifecycle email gaps
6. retention reporting gaps
7. exact code changes required
8. exact dashboards and reports required
```

### Dashboard Prompt

```text
Create a PostHog dashboard spec and CLI query pack for this Clerk app.

Required dashboards:
- acquisition funnel
- auth funnel
- onboarding funnel
- activation funnel
- traffic by source
- core product usage
- lifecycle email performance
- retention by signup source
- email return funnel
- weekly operator report

For each dashboard, define:
- events used
- breakdown properties
- default time windows
- exact output tables or charts
- HogQL queries where appropriate
```

### Verification Prompt

```text
Verify this Clerk app analytics implementation end to end.

Confirm:
- auth events fire correctly
- PostHog identity stitching works
- attribution props are present
- Meta browser/server dedup works
- onboarding and core action events fire
- Resend webhook ingestion works
- email events are stored and forwarded to PostHog
- retention and source reports return valid rows

Return:
- verified items
- gaps still remaining
- config steps needed in production
```

## Deliverables Every Project Should Have

- shared browser analytics module
- shared attribution module
- auth completion tracker
- Meta conversion helper
- server-side PostHog capture helper
- email tracking helper
- delivery/event tables for lifecycle email
- webhook route for email engagement
- event ontology doc
- env var doc
- storage map doc
- dashboard specs
- retention report CLI or saved queries

## Notes

This playbook is intentionally stricter than most template analytics setups.

That is the point.

Most Clerk apps can tell you:

- how many people hit the landing page
- how many signed up

This playbook makes them able to tell you:

- where users came from
- what they did before auth
- what broke during onboarding
- what first value looked like
- which source cohorts retained
- which lifecycle emails reactivated which cohorts

