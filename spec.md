# AI Tutor Platform Implementation Spec (Greenlight-Based + Gemini-Exact)

## 1. Objective
Build a production application for learners and employers where:
1. Learners use a dedicated AI Tutor agent to build AI skills.
2. Learners generate public proof artifacts (website/profile/project/build log/social outputs).
3. Employers search a talent board of verified AI-native candidates.

Implementation is infrastructure-first, Gemini-exact UI pass near the end, and blocked by hard verification gates.

## 2. Locked Product Decisions
1. Canonical visual baseline: `mockups/high_fidelity` with Gemini deltas from `Gemini Design/`.
2. Runtime architecture uses Greenlight patterns adapted to AI Tutor domain.
3. MVP has no silent fallback behavior; all dependency failures are explicit and actionable.
4. Local mockup runtime target is `http://localhost:6396`.

## 3. Architecture
### 3.1 Monorepo shape
1. `apps/web`: Next.js App Router UI + API routes.
2. `apps/worker`: queue processor + scheduler handlers.
3. `packages/shared`: matrix/config/types/state/runtime logic.
4. `supabase/migrations`: SQL schema, RLS, claim RPC, seeded matrix catalog.
5. `tests`: unit, integration, e2e.
6. `docs`: runbooks/checklists.

### 3.2 Greenlight parity mapping
1. `agent_jobs` claim/lease/retry lifecycle.
2. `agent_job_events` event stream to dashboard/chat (SSE endpoint).
3. `agent_memory` table pattern and refresh job slot.
4. scheduler module for relevant AI news refresh.
5. daily update generation and send/fail pipeline.
6. artifact generation framework for `website|pptx|pdf|resume_docx|resume_pdf`.
7. explicit failure eventing + deterministic recovery actions.

### 3.3 Core runtime modules
1. Onboarding + assessment engine.
2. Matrix-driven role/module/tool catalog.
3. Project lifecycle and artifact generation.
4. Verification policy and state machine.
5. Social draft generation + publish modes.
6. Employer marketplace search/facets.
7. SEO/metadata/OG surfaces.

## 4. Gemini Design Contract
1. Dark refresh removes indigo/purple emphasis.
2. Light mode via `:root[data-theme="light"]` token set.
3. Nav theme toggle + `localStorage` persistence.
4. Hero image replaced by non-interactive iframe to `/dashboard/`.
5. Copy replacements:
   1. Landing: `System-Verified Proof of Work`.
   2. Employer: `100% System-Verified Skill Proofs`.
   3. Dashboard/profile badges: `Platform Verified` or `AI Tutor Verified`.
6. Matrix is source-of-truth for onboarding options, dashboard module checklists, and employer filters.

## 5. Public APIs
### 5.1 Onboarding/assessment
1. `POST /api/onboarding/start`
2. `POST /api/onboarding/situation`
3. `POST /api/onboarding/career-import`
4. `POST /api/assessment/start`
5. `POST /api/assessment/submit`

### 5.2 OAuth
1. `GET /api/auth/linkedin/start`
2. `GET /api/auth/linkedin/callback`
3. `GET /api/auth/x/start`
4. `GET /api/auth/x/callback`

### 5.3 Dashboard and projects
1. `GET /api/dashboard/summary`
2. `POST /api/projects`
3. `POST /api/projects/:id/chat`
4. `GET /api/projects/:id/events` (SSE)
5. `POST /api/projects/:id/generate-website`
6. `POST /api/projects/:id/generate-artifact`

### 5.4 Profile, SEO, OG
1. `PATCH /api/profile`
2. `POST /api/profile/publish`
3. `GET /api/profile/:handle`
4. `GET /api/og/profile/:handle`
5. `GET /api/og/project/:handle/:projectSlug`

### 5.5 Social publishing
1. `POST /api/social/drafts/generate`
2. `POST /api/social/drafts/:id/publish?mode=api|composer`

### 5.6 Employer
1. `GET /api/employers/talent`
2. `GET /api/employers/talent/:handle`
3. `POST /api/employers/leads`

### 5.7 Scheduler
1. `POST /api/scheduler/news-refresh`
2. `POST /api/scheduler/daily-update`

## 6. Data and Contracts
### 6.1 Shared types
1. `CareerPath`
2. `ModuleTrack`
3. `SkillStatus = not_started|in_progress|built|verified`
4. `ThemeMode = dark|light`
5. `VerificationPolicy`

### 6.2 Matrix contract guarantee
Single matrix config must compile to:
1. onboarding role/career options,
2. dashboard module recommendations,
3. employer talent facets.

### 6.3 Database tables (Supabase)
1. `career_paths`, `skill_domains`, `module_catalog`, `tool_catalog`
2. `learner_profiles`, `projects`, `project_artifacts`
3. `user_module_progress`, `user_skill_evidence`
4. `verification_policies`, `verification_events`
5. `agent_jobs`, `agent_job_events`, `agent_memory`
6. `news_insights`, `daily_update_emails`

## 7. Verification State Machine
`not_started -> in_progress -> built -> verified`

Rules:
1. module/project work moves skills into `in_progress`.
2. generated artifacts + minimum evidence move to `built`.
3. policy threshold checks promote to `verified`.
4. score degradation can demote `verified -> built`.

## 8. Fail-State Policy (No Silent Fallback)
For OAuth, provider, worker, metadata, or email failures:
1. API returns structured error code.
2. blocking state is persisted and surfaced in UI.
3. recovery action is returned.
4. user retries from deterministic state.

## 9. SEO and URL Standards
1. Profile: `/u/:handle`
2. Project: `/u/:handle/projects/:projectSlug`
3. Talent list: `/employers/talent`
4. Candidate detail: `/employers/talent/:handle`

Requirements:
1. canonical metadata,
2. OG/Twitter metadata,
3. JSON-LD for public profile/project,
4. `robots.ts` and `sitemap.ts`.

## 10. Phased Implementation Plan
### Phase 0
1. monorepo scaffold,
2. scripts/pipelines,
3. env contract + launch checklist generator.

### Phase 1
1. Supabase schema + RLS,
2. claim RPC,
3. seeded matrix catalog.

### Phase 2
1. worker claim loop,
2. job event generation,
3. scheduler hooks.

### Phase 3
1. onboarding/assessment/profile/project/social/employer/news APIs,
2. verification policy/state engine,
3. SSE events endpoint.

### Phase 4
1. OAuth flows (LinkedIn + X),
2. daily email pipeline,
3. explicit fail-state routes and UI messaging.

### Phase 5
1. functional route shells for landing, onboarding, dashboard, profile, marketplace,
2. profile/project OG + SEO surfaces,
3. 20 fake employer-side candidates.

### Phase 6
1. Gemini-exact visual pass (theme, copy, hero iframe),
2. matrix-driven UI options everywhere,
3. public profile/project card polish.

### Phase 7
1. test hardening,
2. deployment dry-run,
3. launch checklist and rollback notes.

## 11. Hard Verification Gates
### 11.1 Browser (Playwright)
1. theme toggle works and persists,
2. no legacy cryptographic copy,
3. hero iframe to `/dashboard/` with non-interactive behavior,
4. onboarding options from matrix,
5. employer filters from same matrix,
6. dashboard/fail-state surfaces visible.

### 11.2 CLI
1. `pnpm checklist:env`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm test:integration`
6. `pnpm test:e2e`
7. `pnpm build`
8. `pnpm verify:migrations`
9. `pnpm verify:deploy`

### 11.3 Design grep checks
1. no `hero.png` references in production app surfaces,
2. no `Cryptographically Verified` string,
3. no forbidden legacy indigo/purple patterns.

## 12. Verification Execution Procedure
1. Start app with `pnpm --filter @aitutor/web dev` and verify runtime on `http://localhost:6396`.
2. Run Playwright hard-gate suite.
3. Run full CLI verification sequence.
4. Generate env checklist output (`docs/launch_checklist.json`).
5. Block launch on any failed gate.

## 13. Data Policy for Mockups and Local Validation
1. believable fake identity data is limited to landing and employer portal.
2. learner flows use synthetic test user handles and IDs.
3. employer marketplace includes 20 fake candidate rows for filter/testing.
4. end-to-end user creation is supported via onboarding APIs and wizard UI.
