# Continuity Ledger: MyAISkillTutor Rebuild

## Goal
Turn MAST (myaiskilltutor.com) from "production-grade funnel, hollow product" into functional + retaining:
anonymous LLM skill-gap assessment before the gate, real LLM-generated proof artifacts + tutor-driven
lessons behind the paywall, retention loops past week 1. Done = the verification criteria per phase in
`thoughts/shared/plans/2026-07-07-myaiskilltutor-rebuild.md`.

## Constraints
- TDD: failing test first for every behavior change; keep existing 31-file vitest suite green.
- No silent fallbacks (repo's `*_MISSING` error contract). Failed generation NEVER emits placeholder.
- Don't grow `apps/web/lib/runtime.ts` (5,749 lines) — new modules; extract what's touched.
- Sequential implementation agents only; verify each agent's claims before proceeding.
- OpenAI Responses API pattern from `generateTutorReply` (runtime.ts:2623); Supabase storage for artifacts.

## Key Decisions
- Plan + full audit: `thoughts/shared/plans/2026-07-07-myaiskilltutor-rebuild.md`,
  `thoughts/shared/research/2026-07-07-myaiskilltutor-product-audit.md` (from portfolio session 393e92e6, 2026-07-07).
- Tutor-driven lessons over authored curriculum (don't write content; tutor runs existing playbooks).
- Deterministic assessment scorer becomes an input signal to the LLM report, not the deliverable.
- Talent board deferred (synthetic-seeded).
- Phase 1 → Phase 2 has a DEMAND GATE: ship free assessment, check pull before the 2-week Phase 2 spend.

## State
- Done:
  - [x] Analysis + plan + ledger written (2026-07-07)
  - [x] Product definition decided: living AI-readiness score + weekly proof artifact + landscape monitoring; daily actions = habit layer
  - [x] MDD absorption decided; MDD audit saved (thoughts/shared/research/2026-07-07-mydailydownload-audit.md); plan Phase 3 rewritten
  - [x] Miguel GO 2026-07-07: full build, ship-live authority delegated, all decisions delegated, stay on Fable 5
- Done (cont.):
  - [x] Phase 0 nearly done (2026-07-07): parked Social Radar (park/social-radar), Workspace (park/workspace-prototype), WIP funnel tests (park/wip-funnel-tests, 7 failing tests); pruned 7 stale worktrees; committed loading.tsx + mockups + plan docs to main; baseline GREEN 61/61. FOUND+FIXED: OPENAI_API_KEY was missing from Vercel PRODUCTION env for 127 days (tutor chat dead in prod since launch) — added, redeploying. Stripe prod vars confirmed present (110d). Remaining: real-card conversion (Miguel).
  - [x] Phase 1 CODE COMPLETE (2026-07-07, branch rebuild/core-product, uncommitted): anonymous assessment at /assessment (no Clerk gate; CTAs un-rewritten in page.tsx + gemini-static-page.tsx), LLM report module apps/web/lib/assessment-report.ts (extracted OpenAI plumbing → apps/web/lib/openai-responses.ts, runtime.ts SHRUNK), anonymous_assessments + assessment_report_history tables (migration 20260707150000, NOT applied to prod), report page /assessment/report/[token], Resend report email, email-match linking (dashboard/_lib + onboarding claim/complete), 4 funnel events + admin analytics tracked steps, proxy.ts whitelists /api/assessment/anonymous/* AND /api/analytics/funnel (was 401 for anon visitors!). Suite 61→102 green; web build green. ⚠️ OPENAI_API_KEY in local .env AND apps/web/.env.local both 401 (rotated?) — live LLM sanity check blocked; run `pnpm vitest run tests/live/assessment-report.live.test.ts` after key rotation.
  - [x] Phase 1 VERIFIED (2026-07-07 pm): Miguel supplied new OpenAI key → 200-validated, written to .env + apps/web/.env.local + all 3 Vercel envs (dead key removed everywhere). Live LLM report test PASSED (real gpt-4.1-mini, output quality good). 102/102 + build verified independently. Phase 1 committed on rebuild/core-product (b04d40d). Social-radar migration file restored for remote-history parity (31da6c3). Prod redeployed from main with working key → tutor chat live in prod for first time since March.
- PROD FINDINGS during Phase 1 E2E (2026-07-07): (a) RESEND_FROM_EMAIL was unset everywhere → all product emails fell back to onboarding@resend.dev sandbox sender → lifecycle emails to real users have been silently failing since launch. FIXED: set "My AI Skill Tutor <hello@myaiskilltutor.com>" (domain verified in Resend) in all 3 Vercel envs + redeployed. (b) NO cron config exists (no vercel.json, no GH workflow) and scheduler routes (news-refresh, daily-update) are POST-only → daily news/daily-update emails never fire automatically; Vercel cron sends GET (same bug as LCM patrol). FIX IN PHASE 3 (rewires news-refresh anyway): vercel.json crons + GET handlers + CRON_SECRET. (c) CSP blocks googletagmanager.com in prod → Google Ads/GA4 tag never loads (the parked WIP tests were a half-done fix); matters when ad spend unlocks. (d) E2E VERIFIED live: CTAs → /assessment, anonymous flow, real LLM report (score 52, marketing-seo, quality good), tokenized report page, email captured; Supabase rows confirmed (anonymous_assessments completed + assessment_report_history readiness_score=52 gpt-4.1-mini).
- Done (cont. 2):
  - [x] Phase 2 CODE COMPLETE (2026-07-07, branch rebuild/core-product, uncommitted): (2.1) real LLM artifact generation — packages/shared/src/artifact-content.ts (zod schemas website/resume/deck/brief + prompt + generator; openai-responses moved to shared so the worker shares the exact client; web re-exports behind server-only), content persisted to NEW project_artifact_contents table (apps/web/lib/artifact-content-store.ts dual-mode), runtimeRequestArtifactGeneration + runtimeRecordProjectArtifact EXTRACTED from runtime.ts (5701→5475 lines) into apps/web/lib/artifact-generation.ts, worker processArtifactJob does real generation (context snapshotted into job payload; DB fallback), /generated/[...slug] feeds the existing writers real content (multi-slide pptx w/ speaker notes, real website copy page, resume/brief lines; artifact URLs without stored content → 404, demo slug exempt). HARD FAILURE everywhere: LLM failure = job failed + no artifact + no state flip + never a placeholder. (2.2) tutor sessions — apps/web/lib/tutor-session.ts + NEW module_tutor_sessions table, routes /api/projects/[id]/tutor-session{,/step,/checklist,/complete,/message}, workbench UI panel (current step + evidence note, proof checklist toggles, ask-tutor box, complete CTA w/ optional artifact kind). (2.3) built gated on real generated content OR submitted proof (packages/shared/src/verification-gating.ts); verified gated on tutor-checklist completion + built evidence (awardVerifiedSkillForProject / markSkillVerified); module-step completion NO LONGER auto-awards built (runtime.ts + store.ts); legacy placeholder artifacts never satisfy gates. Tests 102→150 unit green + 3 integration; web/worker/shared builds green. LIVE resume generation verified (real gpt-4.1-mini, grounded in evidence; live test caught+fixed aiProof string-vs-array drift). New migrations 20260707190000 + 20260707191000 (NOT applied).
- Now: [→] BLOCKED on Miguel: `supabase db push` from repo root (classifier requires user-run for prod DB; now THREE additive migrations: 20260707150000, 20260707190000, 20260707191000) — after that: commit Phase 2, merge rebuild/core-product → main, deploy, incognito E2E, Phase 1 demand gate starts.
- Remaining:
  - [ ] Phase 2 prod verification: test-mode paying user completes one module end-to-end (tutor session → checkpoints → generated artifact opens with personalized content → built → verified after checklist); manual artifact-quality inspection
  - [ ] Phase 3: MDD engine port (packages/daily-content) + event re-scoring + proof-of-watch email + streaks/winbacks + SEO-hub funnel (~1-1.5 wks)
  - [ ] Miguel unblock: one real-card prod conversion; OK to point mydailydownload.com hubs at myaiskilltutor.com
- Demand gate (spend, not build): ≥25 completed assessments + ≥40% email capture within 14d of Phase 1 ship → ad spend unlocked

## Open Questions
- UNCONFIRMED: Stripe vars actually set in Vercel prod (Phase 0.3 proves it).
- UNCONFIRMED: subscription price (lives in Stripe, not repo).
- Miguel: demand-gate threshold (assessment completions? email captures? pilots?).
- Miguel: park vs delete Social Radar / Workspace prototype.

## Working Set
- Repo: /Users/miguel/PersonalAITutor (branch `main`, HEAD bd2a29e; untracked Social Radar + Workspace files)
- Implementation branch (create in Phase 0): `rebuild/core-product`
- Tests: `pnpm test` (vitest, repo root); verify scripts `scripts/verify_*`
- Anchors: runtime.ts:1719 (assessment) :2623 (tutor LLM) :2810 (artifact request);
  apps/worker/src/index.ts:2035 (artifact job); apps/web/app/generated/[...slug]/route.ts (writers);
  packages/shared/src/{module-playbooks,matrix,gamification,lifecycle-email,email-campaigns}.ts
- Prod: Vercel project "personalaitutor", myaiskilltutor.com
