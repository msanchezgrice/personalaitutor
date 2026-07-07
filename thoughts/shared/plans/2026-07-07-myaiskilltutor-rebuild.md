# MyAISkillTutor Rebuild — Implementation Plan

Date: 2026-07-07
Source analysis: `thoughts/shared/research/2026-07-07-myaiskilltutor-product-audit.md`
Repo: `/Users/miguel/PersonalAITutor` (pnpm monorepo — `apps/web` Next.js, `apps/worker`, `packages/shared`)
Estimated total: **3–4 weeks** (Phase 0: ~1 day · Phase 1: ~3 days · Phase 2: ~2 weeks · Phase 3: ~1 week)

## Goal

Turn MAST from "production-grade funnel, hollow product" into a product that (a) demonstrates real AI value before the paywall, (b) delivers real generated proof-of-work artifacts and tutor-driven lessons behind it, and (c) has retention loops that survive past week 1.

**Done looks like:** an anonymous visitor takes the assessment without an account and receives a screenshot-worthy LLM skill-gap report; a paying user completes a tutor-run module that ends in a real LLM-generated artifact (website/resume/deck with actual content) tied to a `built`→`verified` state; subscribers receive dynamic weekly progress emails and streak nudges indefinitely; all verified end-to-end in prod with one real paid conversion.

## Product definition (decided 2026-07-07)

**"Your AI skills, scored against your role — and a tutor that raises the number every week, with proof."**

The subscriber deliverable is three reinforcing things:
1. **A living AI-readiness score (0–100)** for their specific role — persistent, trended, re-computable. The free assessment produces it; the paywall sells moving it.
2. **A weekly closed gap with proof** — one tutor-run playbook session per week ending in a real generated artifact; score goes up, artifact lands in the portfolio. Unit of value = "gap closed, provably," not "content consumed."
3. **Landscape monitoring** — the absorbed MyDailyDownload briefing engine (see `thoughts/shared/research/2026-07-07-mydailydownload-audit.md`) watches the AI landscape per career; events re-rank the user's gaps and can move the score ("the bar for analysts rose this week — here's the 20-min action that recovers it"). Same score→trend→alerts→proof-of-watch retention architecture as LeakCheckMe/CloneSentry.

**Daily actions are the habit layer, not the product** — each daily action is derived from the current gap and counts toward the week's artifact. Standalone daily AI tips are a commodity (MDD's near-zero standalone traction is the evidence); MAST's differentiators are personalization to role, proof, and verification.

**Brand decision:** absorb MyDailyDownload into MAST — one product, one score, newsletter as free tier. MDD's 15 SEO career hubs + signup flow become top-of-funnel for the free assessment; its Python engine is retired after the Phase 3 port (cron stays alive until then).

## Constraints

- **TDD:** every behavior change lands with a failing test first. Existing suite (31 files, ~2,929 lines, vitest) must stay green; new core-product coverage is a deliverable, not an afterthought (audit gap #7).
- **No silent fallbacks** — preserve the repo's explicit error contract (`OPENAI_CONFIG_MISSING` pattern). A failed generation must fail loudly, never emit the old placeholder shell.
- LLM calls follow the existing OpenAI Responses API pattern (`generateTutorReply`, `runtime.ts:2623`, `gpt-4.1-mini`); artifacts stored in Supabase storage (bucket pattern already used by `proof-upload`).
- `apps/web/lib/runtime.ts` is a 5,749-line god file: **do not grow it.** New logic goes in new modules (e.g. `apps/web/lib/assessment-report.ts`, `apps/web/lib/artifact-content.ts`, or `packages/shared/src/`); extract from `runtime.ts` only what each phase touches.
- Implementation agents run **sequentially, never concurrently in one worktree**; verify each agent's claims before proceeding (per global feedback rules).
- Prod deploys: Vercel project "personalaitutor". Stripe secrets exist only in Vercel prod env — local paid-funnel testing needs Stripe test keys added to local env first.

## Strategic gate (reframed 2026-07-07 — Miguel authorized full build)

Miguel greenlit the full rebuild on 2026-07-07, so the gate no longer sequences the *build* — it governs **spend and promotion**. Pre-committed threshold (set by Claude under delegated authority): after Phase 1 ships, drive existing MDD SEO traffic + one outreach batch at the free assessment; **≥25 completed anonymous assessments with ≥40% email capture within 14 days of Phase 1 ship** justifies paid acquisition spend on MAST. Below that, finish the build but keep ad budget on Clone Sentry/MFS priorities.

---

## Phase 0 — Baseline, scope cleanup, prove the funnel (~1 day)

**0.1 Park the scope drift.** Untracked on `main`: Social Radar (`apps/web/app/api/social-radar/*`, `apps/web/lib/social-radar.ts`, `packages/shared/src/social-radar.ts`, `supabase/migrations/20260308190000_add_social_radar.sql`, `docs/social_radar_spec.md`) and the Workspace prototype (`packages/workspace-core/`, `apps/workspace-prototype/`, related tests). Commit each to its own parking branch (`park/social-radar`, `park/workspace-prototype`), then remove from `main`'s working tree so the rebuild starts clean. Also prune the stale worktrees: `/Users/miguel/PersonalAITutor_email_lifecycle_ship` (fully merged; audit confirmed `git log main..codex/email-lifecycle-ship` is empty) plus 6 `prunable` entries in `git worktree list` under `/private/tmp/pat-*` and `/private/tmp/personalaitutor-*`.

**0.2 Green baseline.** `pnpm install && pnpm test` (vitest at repo root); record pass/fail counts in the ledger. Fix nothing yet — just establish the baseline.

**0.3 Prove one real paid conversion (audit gap #2).** Verify Stripe env in Vercel prod, run checkout→webhook→dashboard-access end-to-end once with a real card, refund after. Also add Stripe **test-mode** keys to local `.env` so later phases can test the paid path locally.

**Verification:** parking branches exist and `git status` on the main branch is clean; test baseline recorded; one prod conversion observed in Stripe dashboard + `stripe_webhook_events` table + dashboard access granted.

---

## Phase 1 — Invert the lead path (~3 days)

**1.1 Un-gate the assessment.** Landing CTAs currently rewrite to `/sign-up?redirect_url=/onboarding/` (`apps/web/app/page.tsx`, `GeminiStaticPage` string replacements). Change to route to an anonymous assessment flow: quiz + role/goals (+ optional resume/LinkedIn — upload routes exist in onboarding) with **no Clerk account required**. Persist the anonymous session server-side (new table keyed by a session token; follow existing migration/RLS patterns), capture email at the end to deliver the report, and link the anonymous record to the Clerk user on eventual sign-up.

**1.2 Real LLM skill-gap report + persistent score.** Replace the deterministic path — `runtimeSubmitAssessment` (`apps/web/lib/runtime.ts:1719`) scoring + rule-based recommendation — with an LLM-generated report in a new module (`apps/web/lib/assessment-report.ts`): ingest role, goals, quiz answers, resume/LinkedIn text; produce a structured skill-gap report (strengths, gaps ranked by market impact, recommended path from the 9 `matrix.ts` career paths, 30-day plan) **anchored on a persistent 0–100 AI-readiness score** stored per user/anonymous-session with history (new table; every later score movement appends). The score is the product's spine: free tier = see it; paid = move it. Rendered web report page (shareable/screenshot-worthy) + emailed copy. Deterministic scorer stays as input signal, not as the deliverable. Explicit failure if OpenAI config missing — no fallback to the old rule-based text. (MDD's dead `career_analyzer.py` prompts are a useful seed for the extraction prompt.)

**1.3 Funnel events.** Preserve existing funnel/attribution instrumentation across the new flow (the analytics plumbing is the product's strength — don't break it); add events for anonymous-assessment start/complete/email-capture/report-view.

**Tests first:** anonymous session lifecycle; email-capture validation; report generation with mocked LLM (structure + failure contract); CTA routing.

**Verification:** incognito browser → land → complete assessment → receive report at a captured email, zero sign-up friction before the quiz; funnel events visible in the admin analytics; suite green.

**⛔ Gate: demand checkpoint.** Ship Phase 1 to prod, point existing traffic/outreach at the free assessment, and evaluate against the pre-committed threshold before spending Phase 2's two weeks.

---

## Phase 2 — Make the paid product real (~2 weeks)

**2.1 Real artifact generation (THE gap, ~1 week).**
- `runtimeRequestArtifactGeneration` (`runtime.ts:2810`) and worker `processArtifactJob` (`apps/worker/src/index.ts:2035`) currently insert a `project_artifacts` row with a synthetic URL and no content. Add a content-generation step: new `apps/web/lib/artifact-content.ts` (or `packages/shared`) that builds site copy / resume content / deck outlines from the user's profile, assessment report, and completed-module evidence via the Responses API.
- Store generated content (structured JSON + rendered output) in Supabase storage; `/generated/[...slug]/route.ts`'s hand-rolled HTML/PDF/DOCX/PPTX writers get fed real content instead of title+timestamp placeholders.
- Generation is async via the existing worker job; failure marks the job failed loudly (no placeholder emission, no state flip).

**2.2 Tutor-driven lessons (~1 week).** Convert each module playbook (`packages/shared/src/module-playbooks.ts` — why / expected output / 3-item proof checklist / steps) into a **checkpointed tutor session**: the tutor (existing `generateTutorReply` infrastructure) walks the user step-by-step, checks off proof-checklist items on evidence, and ends by triggering artifact generation (2.1) or a proof-upload. Session state persisted per module (new table or extension of the project state); resumable.

**2.3 Make `built`/`verified` mean something.** The `not_started→in_progress→built→verified` state machine exists — gate `built` on an artifact row with real stored content (or user-submitted proof via the existing `proof-link`/`proof-upload` routes), and `verified` on the proof-checklist completion from 2.2. Remove the auto-award of skills from placeholder artifacts.

**Tests first:** artifact content generation (mocked LLM) → storage → rendering pipeline; job failure contract (no placeholder, no state flip); tutor session checkpoint transitions; state machine gating rules.

**Verification:** as a paying (test-mode) user, complete one module end-to-end: tutor session → checkpoints → generated artifact that opens as a real website/resume/deck with personalized content → skill shows `built`, then `verified` after checklist completion. Manual inspection of artifact quality — the artifact must be something a user would actually show an employer.

---

## Phase 3 — Retention: monitoring loop + MDD absorption (~1–1.5 weeks)

**3.1 Port the MDD briefing engine → `packages/daily-content`.** Mechanical TS port of `newsletter-backend/news_feeds.py` + `news_engine.py` from `/Users/miguel/mydailydownload` (~500 LOC: RSS fetch/canonicalize/dedupe, keyword×recency×trending×trust ranking, grounded gpt-4o-mini summarization, **no-fabrication guardrail preserved verbatim in behavior** — every emitted URL must exist in the fetched set or the block is dropped). Map the 15-career taxonomy onto MAST's 9 `matrix.ts` paths (merge `search_terms`). Run from MAST's existing worker/scheduler (`scheduler/news-refresh` slot), write briefings to MAST's Supabase. This **replaces** `generateNewsFromOpenAi` (`runtime.ts:4535`) — real sourced briefings instead of generic LLM news. Leave behind: `career_analyzer.py` (dead), legacy SQLite runner, MDD branding.
**3.2 Event-driven re-scoring.** New module interprets each day's briefing against the user's path + open gaps: significant events adjust gap rankings and can move the role bar (score delta), and emit the user's **daily action** ("15 min: X — counts toward Artifact #3"). This is what turns news into monitoring.
**3.3 Weekly proof-of-watch email.** Lifecycle emails (`packages/shared/src/lifecycle-email.ts`, `email-campaigns.ts`) stop after `week_one`. Add a recurring weekly report computed **at send time**: score trend, gaps closed, artifacts added, what changed in the landscape this week and what it means for *you*, next recommended step. Wire into existing scheduler/worker pipeline.
**3.4 Streaks + winbacks.** Streaks on daily-action completion (build on `packages/shared/src/gamification.ts`), surfaced on dashboard + emails; 7/14/30-day inactivity winbacks anchored to the user's report ("your gap plan has 3 unfinished steps").
**3.5 Funnel absorption.** Repoint MDD's 15 SEO career hubs (`web/app/ai-for/[career]`) at MAST's free assessment; MDD newsletter signup becomes MAST free tier. Keep the MDD GitHub Actions cron alive until 3.1 ships, then retire the Python engine.
**Deferred:** employer talent board (synthetic-seeded today) — the long-term moat, but not part of this rebuild.

**Tests first:** ranking determinism on fixture feeds; guardrail (fabricated URL → block dropped, top-story missing → hard failure); taxonomy mapping; re-scoring rules; weekly report computed from live data at send time (not frozen at trigger creation); streak increment/reset; winback windows; idempotent sends.

**Verification:** a fixture month-2 subscriber's proof-of-watch email differs from their day-0 email and cites only real fetched URLs; briefing visible on dashboard with today's action; streak visible; suite green; deploy + `/qa` pass on prod.

---

## Cross-cutting deliverables

- New core-product tests at every phase (audit gap #7) — the suite currently covers billing/funnel only.
- Any `runtime.ts` code touched gets extracted to a module, never extended in place.
- Update `spec.md` or add a README pointing to this plan, so the repo has a current source of truth (audit found none).

## Open questions

- UNCONFIRMED: whether Vercel prod env actually has all three Stripe vars set (audit inferred from code contract; Phase 0.3 proves it).
- UNCONFIRMED: exact subscription price (lives in Stripe, not repo).
- DECIDED (Claude, delegated 2026-07-07): demand threshold = ≥25 completed assessments + ≥40% email capture in 14 days post-Phase-1 → unlocks ad spend. Scope-drift fate = park on branches (not delete). MDD = absorb (engine ported, brand → top-of-funnel).
- Miguel unblock list: one real-card prod conversion (Phase 0.3 — Claude has no payment card); confirm MDD SEO hubs may 301/link to myaiskilltutor.com.

## Working set

- Branch: create `rebuild/core-product` off the default branch after Phase 0 parking.
- Test command: `pnpm test` (vitest, repo root). Verify scripts: `scripts/verify_*`.
- Key anchors: `apps/web/lib/runtime.ts:1719` (assessment), `:2623` (tutor LLM), `:2810` (artifact request); `apps/worker/src/index.ts:2035` (artifact job); `apps/web/app/generated/[...slug]/route.ts` (writers); `packages/shared/src/{module-playbooks,matrix,gamification,lifecycle-email,email-campaigns}.ts`.
- Ledger: `thoughts/ledgers/CONTINUITY_CLAUDE-myaiskilltutor-rebuild.md`
