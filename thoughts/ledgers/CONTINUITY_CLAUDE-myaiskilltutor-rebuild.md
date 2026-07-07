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
- Now: [→] Phase 0: Baseline, scope cleanup (park Social Radar + Workspace, prune stale worktrees), verify Stripe prod env
- Remaining:
  - [ ] Phase 1: Invert lead path — anonymous assessment + LLM skill-gap report + persistent 0-100 score (~3 days)
  - [ ] Phase 2: Real artifact generation + tutor-driven lessons + real built/verified states (~2 wks)
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
