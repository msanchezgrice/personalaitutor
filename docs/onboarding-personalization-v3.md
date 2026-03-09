# Onboarding Personalization V3

Version: 2026-03-09
Owner: product + engineering
Status: implemented baseline, content expansion still open

## Goal

Turn onboarding answers into a real first-run experience:

- a role-specific path
- a concrete first module or pack
- visible XP, achievements, and badges
- dashboard copy that matches the learner's role
- lifecycle emails that point to the next useful action
- analytics that let us measure activation, retention, and attribution by track

This spec keeps the current dashboard design language and only changes logic, content, and personalization.

## Personalization Inputs

Primary onboarding inputs:

- `careerCategory`
- `careerPathId`
- `jobTitle`
- `yearsExperience`
- `companySize`
- `situation`
- `selectedGoals`
- `aiComfort`
- `linkedinUrl`
- `resumeFilename`
- assessment answers

Derived signals:

- recommended career paths
- primary module recommendations
- project and proof readiness
- public profile readiness
- gamification state

## Personalization Pipeline

1. Start onboarding session.
2. Save draft answers as the learner progresses.
3. Save selected career path, role, context, and situation.
4. Run assessment.
5. Resolve recommended career paths.
6. Update learner profile `careerPathId`.
7. Generate dashboard summary:
   - module recommendations
   - active project
   - proof state
   - starter skill plan or verified skill stack
   - gamification
8. Render dashboard/home/chat/projects/social/news/profile from the same summary.
9. Drive lifecycle email cadence from onboarding + assessment + module CTA state.

## Module System

Each module should be implemented as a structured object, not just copy.

Required fields:

| Field | Purpose |
| --- | --- |
| `id` | stable module key |
| `careerPathId` | owning track |
| `title` | user-facing module name |
| `whyThisModule` | plain-English rationale shown in UI/email |
| `summary` | one-line description |
| `format` | `lesson`, `quiz`, `guided_build`, `tool_setup`, `proof_task`, `chat_lab`, or `upload_review` |
| `delivery` | `text`, `chat`, `form`, `integration`, `upload`, or mixed |
| `estimatedMinutes` | planning and pacing |
| `steps` | ordered actionable steps |
| `artifacts` | what the learner produces |
| `verificationMode` | `auto`, `upload`, `self_report`, `integration`, or mixed |
| `xp` | XP awarded on completion |
| `achievementKey` | optional unlock |
| `badgeKey` | optional milestone unlock |

## Delivery Types

| Type | What ships in product | Verification |
| --- | --- | --- |
| `lesson` | text blocks, examples, lightweight prompt templates | completion only |
| `quiz` | multiple choice or self-rating | auto |
| `guided_build` | step-by-step build flow with checkpoints | auto plus self-report |
| `tool_setup` | connect tool or configure workflow | integration or screenshot upload |
| `proof_task` | publish artifact, case study, or post | URL paste, text upload, image upload |
| `chat_lab` | AI tutor session with prompt scaffolding | chat completion plus output save |
| `upload_review` | learner uploads screenshot, doc, or image for feedback | upload |

Implementation implication:

- text + quiz is sufficient for foundation modules
- build modules need checkpoint state
- proof modules need text upload, image upload, or URL paste
- integration modules need OAuth or guided fallback with self-report

## Career Paths And Starter Packs

| Track | User-facing path name | Starter modules | Default proof target | Tool emphasis |
| --- | --- | --- | --- | --- |
| `product-management` | Product Management | Synthetic User Research, AI Wireframing, PRD Generation | workflow case study or prototype brief | Cursor, v0.dev, Claude, OpenAI |
| `marketing-seo` | Marketing & SEO | Programmatic SEO, Bulk Content Generation, AI Keyword Clustering | landing page or content system proof | Jasper, ChatGPT, Python |
| `branding-design` | Branding & Design | Image Synthesis, Style-consistent Training, Vector Generation | visual system proof pack | Midjourney, Stable Diffusion, Runway |
| `quality-assurance` | Quality Assurance | Edge-case Discovery via LLMs, Visual Regression, NLP-driven Test Scripts | test automation proof artifact | Playwright, Copilot |
| `sales-revops` | Sales / RevOps | Predictive Lead Scoring, Deep Data Enrichment, Hyper-personalized Cold Outreach | outreach workflow or scoring proof | Clay, Apollo, Zapier, Make |
| `customer-support` | Customer Service | RAG Document Retrieval, Intelligent Ticket Routing, Tone & Sentiment Detection | support workflow proof | Zendesk AI, Pinecone, Python |
| `operations` | Operations | Cross-application Data Sync, OCR Document Processing, Intelligent Extraction | operations workflow proof | Zapier, Make, Vision API |
| `human-resources` | Human Resources | Screening Workflow Automation, Interview Signal Summaries, Policy Assistant Copilot | recruiting or people-ops proof | Greenhouse, Lever, Notion AI |
| `software-engineering` | Software Engineering | API Integration, System Architecture, RAG Setup, Prompt Engineering in Code | shipped technical artifact | Python, Node.js, LangChain, Cursor |

## Module UX Rules

For every recommended module, the product should show:

- title
- one-line summary
- `Why this module`
- estimated effort
- expected output
- primary CTA: `Start {module}` or `Continue {module}`
- proof expectation: what counts as visible completion

The module screen should support:

- overview tab
- checklist steps
- AI Tutor prompt help
- proof submission state
- completion/XP unlock state

## Verification Model

| Verification mode | UX needed | Example modules |
| --- | --- | --- |
| `auto` | completion state, score capture | lesson, quiz |
| `self_report` | confirmation step, typed reflection | guided build without integration |
| `upload` | text upload, image upload, file upload | proof task, screenshot-based setup |
| `url_paste` | link input and validator | public profile, portfolio, live demo |
| `integration` | OAuth/API state and success callback | LinkedIn, X, CRM, help desk tools |

Current required capture surfaces:

- text input / reflection
- URL paste
- image upload
- file upload
- integration connection state

## Gamification

XP comes from unlocked achievements.

Achievement set:

| Key | User-facing title | XP |
| --- | --- | --- |
| `profile_ready` | Workspace Activated | 20 |
| `onboarding_started` | First Signal Captured | 25 |
| `assessment_completed` | Direction Locked | 45 |
| `project_started` | Pack Starter | 35 |
| `chat_started` | AI Teammate Activated | 20 |
| `first_output` | Proof in Progress | 60 |
| `social_draft_created` | Voice in Motion | 30 |
| `profile_published` | Spotlight On | 40 |
| `project_completed` | Outcome Shipped | 80 |
| `verified_skill` | Signal Verified | 120 |

Badges:

- `Pathfinder`
- `Builder Mode`
- `Proof Runner`
- `Public Builder`
- `Trusted Operator`

Levels:

| Level | XP threshold | Label |
| --- | --- | --- |
| 1 | 0 | Starter Builder |
| 2 | 90 | Active Builder |
| 3 | 180 | Proof Builder |
| 4 | 300 | Signal Operator |
| 5 | 450 | Workflow Leader |
| 6 | 650 | AI Operator |

Rules:

- first session should already be able to unlock Level 1 and at least one achievement
- simple actions should still sound meaningful
- sidebar level card always reflects summary gamification state
- dashboard home should show current level, unlocked badges, and recent achievements

## Lifecycle Emails

Brand rules:

- header brand: `AI Tutor`
- hero line: `{{first_name}}, here is your next move.`

Campaign sequence:

- `welcome`
- `day_1_next_steps`
- `day_2_follow_up`
- `day_3_follow_up`
- `week_1_digest`

Logic rules:

- evaluate every 60 seconds
- anchor on latest onboarding session `created_at`
- current-stage only, no backlog replay
- each campaign sends once
- module CTA prefers in-progress module, otherwise next unbuilt module
- week 1 includes latest project, up to 2 social drafts, and up to 3 AI news items

Personalization requirements:

- refer to assessment state: completed, abandoned, not started
- use track-aware module CTA
- use project title when available
- use fallback social drafts if none exist

## Analytics

New required events:

- `career_track_selected`
- `xp_total_changed`
- `xp_level_unlocked`
- `achievement_unlocked`
- `badge_unlocked`
- `career_track_changed`

Required shared properties:

- `location`
- `career_path_id`
- `primary_track_name`
- `xp_total`
- `previous_xp_total`
- `xp_delta`
- `level`
- `level_label`
- `achievement_key`
- `achievement_title`
- `badge_key`
- `badge_title`

Use these for:

- activation by track
- badge and level retention curves
- module continuation rates by track
- attribution by career path and unlock depth

## Current Implementation Status

Implemented:

- sales, operations, HR, and customer service onboarding path support
- dashboard summary gamification object
- dynamic sidebar level card
- home dashboard progress, achievements, and badge section
- projects tab module workbench with why-this-module copy, build steps, proof checklist, and artifact generation actions
- public profile gating until explicit publish
- onboarding and assessment analytics without PM hardcoding
- unlock analytics for XP, levels, achievements, badges, and track changes
- lifecycle email structure already aligned to the next-move format

Still open for content expansion:

- richer module bodies per track
- deeper proof templates per module
- more integrations beyond current LinkedIn/X/supporting tool flows
- deeper per-step verification UI beyond the current starter workbench
