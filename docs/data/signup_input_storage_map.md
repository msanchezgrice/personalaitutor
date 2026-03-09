# Signup Input Storage Map

This maps the actual persisted storage path for signup, onboarding, assessment, and early chat inputs in the current app.

## Source of truth by stage

| Stage | Input | Primary persistence | Secondary / normalized persistence | Analytics copy |
| --- | --- | --- | --- | --- |
| Clerk signup | Auth identity, external user id, email, signup timestamp | `learner_profiles.external_user_id`, `learner_profiles.contact_email`, `learner_profiles.created_at` | `learner_profiles.handle`, `full_name`, default profile scaffolding | `clerk_sign_up_started`, `clerk_sign_up_completed`, `auth_sign_up_completed` |
| Attribution | UTM / referrer / click IDs | `learner_profiles.acquisition`, `onboarding_sessions.acquisition.first`, `onboarding_sessions.acquisition.last` | N/A | Attached to auth/onboarding/dashboard events as `utm_*`, `paid_source`, click IDs |
| Onboarding draft | `fullName`, `careerCategory`, `careerCategoryLabel`, `customCareerCategory`, `careerPathId`, `jobTitle`, `yearsExperience`, `companySize`, `situation`, `linkedinUrl`, `selectedGoals`, `aiComfort`, `resumeFilename`, `uploadedResumeName`, `currentStep` | `onboarding_sessions.acquisition.intakeProfile` via `/api/onboarding/draft` | `learner_profiles.full_name` is updated from draft when present | Structured subset only on PostHog events |
| Onboarding situation | `situation`, `goals` | `onboarding_sessions.situation`, `onboarding_sessions.goals` | `learner_profiles.goals` | Included on `onboarding_*` events |
| Career import | `careerPathId`, `careerCategoryLabel`, `jobTitle`, `yearsExperience`, `companySize`, `aiComfort`, `linkedinUrl`, `resumeFilename` | `onboarding_sessions.career_path_id`, `linkedin_url`, `resume_filename`, plus mirrored `acquisition.intakeProfile` fields | `learner_profiles.career_path_id`, `headline`, `social_links.linkedin` | Structured subset on `onboarding_*` events |
| Assessment | Question answers array (`questionId`, `value`) | `assessment_attempts.answers`, `assessment_attempts.score`, `assessment_attempts.recommended_career_path_ids` | `learner_profiles.career_path_id` is updated to top recommendation | Derived answer props on `onboarding_assessment_complete` and `onboarding_completed` |
| Lifecycle email delivery | Send-level fact row, provider message id, cohort source snapshot | `learner_email_deliveries` | `learner_profiles.welcome_email_sent_at` for the first welcome send | Copied into PostHog as `email_sent` with `cohort_*` + email `utm_*` props |
| Lifecycle email engagement | Open / click / bounce / unsubscribe webhook facts | `learner_email_events` | Tracked links append `email_delivery_id`, `email_campaign_key`, `email_cta`, and email `utm_*` params | Copied into PostHog as `email_delivered`, `email_opened`, `email_clicked`, `email_bounced`, `email_complained`, `email_unsubscribed` |
| Early chat | Raw user message text | `build_log_entries.message` with `User message: ...`; `agent_jobs.payload.message` for `project.chat` jobs | Project and job event history | PostHog receives only `chat_message_sent` plus metadata like `message_length` |

## Important behavior notes

- The onboarding draft is autosaved during the flow and also flushed on tab hide / page hide with `sendBeacon`, so the persisted draft can be ahead of the final onboarding completion payload.
- Free text is intentionally not sent to PostHog:
  - LinkedIn URL / resume file details
  - raw chat text
- PostHog is for structured funnel analysis. Supabase is the source of truth for raw user-provided answers.
- Lifecycle email return visits should now be attributable in browser events via `utm_source=lifecycle_email`, `utm_medium=email`, `utm_campaign=<campaign_key>`, and `utm_content=<cta_name>`.

## Where to inspect it

- Protected operator UI: `/dashboard/admin/signups`
- Signup + answer query: `runtimeListSignupAuditRecords()` in `apps/web/lib/runtime.ts`
- Draft persistence route: `apps/web/app/api/onboarding/draft/route.ts`
- Final onboarding completion route: `apps/web/app/api/onboarding/complete/route.ts`
- Assessment submit route: `apps/web/app/api/assessment/submit/route.ts`
