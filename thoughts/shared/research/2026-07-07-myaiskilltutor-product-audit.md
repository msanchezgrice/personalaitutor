# MyAISkillTutor — Product Audit & Viability Analysis (2026-07-07)

> Provenance: produced 2026-07-07 in portfolio-prioritization session `393e92e6-bedf-4f44-a2af-c68cb2144686`
> as part of a cross-portfolio audit (MFS, Clone Sentry, LaunchBuddy, LeakCheckMe, ToastBuddy, WillBuddy, MAST).
> Audit ran as a very-thorough Explore agent over `/Users/miguel/PersonalAITutor`; proposal synthesized in the
> main session. Scores: funnel/billing **8/10**, product **3/10**, engineering **7.5/10**, completeness **4.5/10**.

---

## Part 1 — Full codebase audit (verbatim agent report)

# Audit: My AI Skill Tutor (`ai-tutor-platform` / Vercel "personalaitutor")

## (a) What it is — in 3 sentences

"My AI Skill Tutor" (domain `myaiskilltutor.com`) is a Next.js monorepo that sells AI‑upskilling for working professionals: a personalized, role‑based learning experience with a 24/7 GPT tutor, daily AI news, and a "proof‑of‑work" portfolio (websites/resumes/decks) plus an employer talent board. The lead path is an auth‑gated "AI Assessment/analysis" — the landing CTA rewrites to `/sign-up?redirect_url=/onboarding/`, so users sign up (Clerk) → an onboarding wizard (role, goals, LinkedIn/resume) → a short 5‑question quiz whose "analysis" is a deterministic scoring + rule‑based career‑path recommendation (`apps/web/lib/runtime.ts:1719` `runtimeSubmitAssessment`), not a deep AI analysis. The paid product is a 7‑day‑trial Stripe subscription gating a dashboard, but the value behind the paywall is thin: the tutor chat is real, the "curriculum" is short text playbooks, and the headline "proof artifacts" are hollow placeholder files.

## (b) Completeness: 4.5 / 10

The go‑to‑market shell is genuinely production‑grade; the actual product a payer receives is roughly 40% built. Funnel/billing/auth/analytics ≈ 8/10; core learning+proof value ≈ 3/10.

## What works end‑to‑end vs. what stubs out

**The funnel (mostly real):**
- Landing is static "Gemini" HTML rendered via `GeminiStaticPage` with string replacements (`apps/web/app/page.tsx`); all "Start Assessment" CTAs are rewritten to the sign‑up→onboarding path.
- Stripe is fully and carefully wired: checkout session with 7‑day trial + `payment_method_collection: always`, portal, and an idempotent webhook (`apps/web/lib/stripe-server.ts`, `apps/web/lib/billing.ts`, `apps/web/app/api/billing/{checkout,portal,webhook}/route.ts`). Webhook claims events via `runtimeClaimStripeWebhookEvent` (migration `supabase/migrations/20260319190000_add_stripe_webhook_events.sql`) and relays first‑paid‑invoice conversions to Meta/Google/LinkedIn/X (`apps/web/lib/billing-conversion-relay.ts`).
- Gating is enforced: `requireBillingAccess` (`apps/web/lib/billing-access.ts`) blocks chat, generate‑website, generate‑artifact; dashboard shows `BillingGateOverlay`; `shouldRedirectBlockedDashboardPath` redirects non‑paying users.
- **Break point:** `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` are absent from local env (present only, empty, in `.env.example`); the code hard‑throws `_MISSING` without them, so the paid funnel only works against Vercel prod env ("Redeploy production with Stripe billing config"). The actual price/amount lives in Stripe, not the repo.

**The core product (where it's hollow):**
- **Tutor chat — REAL.** `runtimeAddProjectChatMessage` (`runtime.ts:2673`) calls `generateTutorReply` → OpenAI Responses API (`gpt-4.1-mini`, `runtime.ts:2623`) synchronously, with explicit `OPENAI_CONFIG_MISSING` failure (no silent fallback). `OPENAI_API_KEY` is configured locally.
- **Proof artifact generation — STUB.** `runtimeRequestArtifactGeneration` (`runtime.ts:2810`) and the worker's `processArtifactJob` (`apps/worker/src/index.ts:2035`) only insert a `project_artifacts` row with a synthetic URL `/generated/{slug}/{kind}-{ts}.{ext}`, flip project state to "built", and award a skill — **no LLM content is generated.** The `/generated/[...slug]/route.ts` route does dynamically emit a *valid* HTML/PDF/DOCX/PPTX (impressive hand‑rolled OOXML + PDF writers), but the content is only the project title, slug, artifact type, and timestamp — a placeholder shell, not an AI‑built website/resume/deck. This is the central value prop, and it is a facade.
- **Curriculum — THIN.** `packages/shared/src/module-playbooks.ts` (671 lines, 9 career paths in `matrix.ts`) is short guidance per module: a "why", an expected output, a 3‑item proof checklist, 3 one‑line steps, and external tool links (Jira/Figma/Notion/HubSpot). No lessons, video, or graded exercises — it points users to external tools and the tutor chat.
- **Daily AI news — REAL.** `generateNewsFromOpenAi` (`runtime.ts:4535`) with deterministic fallback.
- **Employer talent board — SEEDED/DEMO.** `scripts/seed_talent_roster.mjs` (40KB), `INCLUDE_SYNTHETIC_TALENT`, 20 fake candidates per spec; search/leads routes exist.
- **User‑submitted proof — REAL.** `proof-link` / `proof-upload` routes write to a Supabase bucket, so learners can attach their own external evidence (partly compensating for the fake generator).

## (c) Ordered gap list to "functional" (with rough effort)

1. **Real artifact generation** — make generate‑website/resume/deck produce actual LLM content and store it (Supabase storage), so "proof" is real. This is THE gap. **L, 1–3 wks.**
2. **Verify + prove one real paid conversion** — confirm Stripe env in prod and run checkout→webhook→access end‑to‑end once. **S, 1–2 days** (may just be env config).
3. **Make "built/verified" mean something** — tie the verification state machine (`not_started→in_progress→built→verified`) to real submitted/generated proof instead of the hollow artifact. **M, ~1 wk.**
4. **Real lesson delivery per module** — either author curriculum content or have the tutor drive structured, checkpointed lessons, not just links out. **L, 2–4 wks.**
5. **Long‑term retention loops** — inactivity winback + weekly new‑content drip + streaks; today the email cadence stops after week one. **M, 1–2 wks.**
6. **Resolve scope drift** — decide fate of the two uncommitted parallel products (below); they're diluting focus. **S decision / M to integrate.**
7. **Core‑product test coverage** — current tests barely touch lesson/artifact substance. **S–M.**

## (d) Where retention would have to come from

Today the only genuine recurring‑value engines are the **daily AI news + daily‑update email pipeline** (`scheduler/news-refresh`, `scheduler/daily-update`, worker) and **lifecycle emails** — `welcome` + `day_1/2/3` + `week_one` digest (`packages/shared/src/lifecycle-email.ts`, `email-campaigns.ts`) plus billing‑checkout reminders. Secondary hooks: gamification badges/levels/achievements (`packages/shared/src/gamification.ts`, surfaced on the dashboard) and social‑draft generation. There are **no streaks, no scheduled/live sessions, and no post‑week‑1 re‑engagement.** Realistically retention has to be built on one of: (a) daily personalized AI news/actions that are actually useful, (b) a real multi‑week curriculum with streaks and fresh modules, or (c) an employer‑facing portfolio that creates external stakes — none of which is complete.

## (e) Engineering quality: 7.5 / 10

Strong fundamentals: typed pnpm monorepo, zod‑validated routes, idempotent Stripe webhooks, RLS migrations, an explicit "no silent fallback" error contract, structured funnel/attribution events, 31 test files (~2,929 lines) concentrated on billing/funnel/webhook‑idempotency/lifecycle/analytics, plus verify scripts (`scripts/verify_*`). Weaknesses: a 5,749‑line `runtime.ts` god‑file; the hand‑rolled artifact writers are clever but exist precisely to fake a feature that should be real; and clear scope drift (see below). Core‑product behavior is under‑tested.

## Worktree note (`/Users/miguel/PersonalAITutor_email_lifecycle_ship`)

It IS a git worktree (branch `codex/email-lifecycle-ship`, HEAD `f1f9d12` "Add lifecycle onboarding email campaign"). It is **NOT unshipped** — that HEAD is the merge‑base with `main`, `git log main..codex/email-lifecycle-ship` is empty, and `main` is 36 commits ahead. The lifecycle‑email work is fully merged into main; the worktree is a stale leftover.

**The actual unshipped work is uncommitted (untracked) on `main`:**
- **Social Radar** — a *separate* daily social‑posting tool for Miguel's own portfolio (`docs/social_radar_spec.md`, `apps/web/app/api/social-radar/*`, `apps/web/lib/social-radar.ts`, `supabase/migrations/20260308190000_add_social_radar.sql`). Not core to the tutor product.
- **Workspace** — a new interactive product direction (`packages/workspace-core/`, `apps/workspace-prototype/`): `coding_game` / `image_edit` / `profile.qualifications` with voice + achievements (`packages/workspace-core/src/types.ts`).

## Why it likely stalled

Commit cadence tells the story: 34 commits in week 09, 13 in week 10, 12 in week 11 (an intense ~3‑week build in early–mid March 2026), then a single cleanup commit on 2026‑04‑10 and stop. The late‑stage commits are overwhelmingly **acquisition/measurement**, not product depth — "Track checkout and paid invoice funnel conversions," "Add admin funnel analytics," "Enforce billing access," plus heavy ad‑conversion plumbing (Meta/Google Ads/LinkedIn/X in `lib/ad-conversions.ts`, `fb-pixel.ts`, `google-ads.ts`). Effort went into instrumenting and monetizing a funnel, and into two adjacent un‑shipped products, rather than into the one thing that would make it retain: a real learning/proof engine behind the paywall. There is no TODO ledger or README/CLAUDE.md; the only planning artifacts are `spec.md` (the original ambitious spec), one handoff doc (`thoughts/shared/handoffs/general/2026-03-02_..._frontend-redesign.md`), and `SELFIMPROVE.md` pointing to an external roadmap.

---

## Part 2 — Proposal (verbatim from the session synthesis)

**The diagnosis in one line:** the last three weeks of work on it (March) went into funnel instrumentation and ad-conversion plumbing while the paid product stayed hollow — the flagship "proof-of-work artifacts" generator writes valid HTML/PDF/DOCX files containing *only the project title and a timestamp*. No LLM content whatsoever.

**Phase 1 — invert the lead path (~3 days):**

1. **Un-gate the assessment.** Today the CTA routes to sign-up *before* the quiz — friction exactly backwards. Let visitors take the assessment anonymously, capture email to deliver results. Same MFS/Clone Sentry lesson: value before the gate.
2. **Make "get my analysis" an actual analysis.** The current output is deterministic scoring plus a rule-based path recommendation. Replace with a genuinely impressive LLM-generated skill-gap report — ingest their role, goals, and resume/LinkedIn (upload routes already exist in onboarding) and produce something worth screenshotting. This is the product's first impression and it's currently its weakest artifact.

**Phase 2 — make the paid product real (~2 weeks):**

3. **Real artifact generation.** This is THE gap. The good news: the hard part is weirdly already done — the hand-rolled OOXML/PDF/HTML writers work; they're just fed placeholder strings. Wire the artifact pipeline to actual LLM generation (site copy, resume content, deck outlines from the user's profile and completed modules) and store outputs. A week of my work, high leverage.
4. **Tutor-driven lessons instead of authored curriculum.** Don't write course content (weeks of work, goes stale). The tutor chat is already real (GPT-4.1-mini, clean failure contract) and each module already has a playbook (why / expected output / proof checklist / steps). Make the tutor *run* the playbook as a checkpointed, structured session that ends in a concrete artifact. That converts thin content + working chat into a real learning engine for ~a week.
5. **Tie "built/verified" to real proof** — the state machine exists; connect it to actual generated/submitted artifacts.

**Phase 3 — retention (~1 week):** lifecycle emails currently stop after week one. Add a weekly personalized progress email (real data), streaks around the daily AI news (which is real and already running), and inactivity winbacks. Long term, the employer talent board is the retention moat — external stakes — but it's seeded with 20 synthetic candidates today; defer it.

---

## Part 3 — Strategic context from the portfolio session

- Cross-portfolio pattern: **products that deliver value BEFORE the paywall (MFS preview, Clone Sentry free scan) score highest on delivery; products doing expensive AI work AFTER payment fail at the purchase moment.** MAST's assessment-behind-signup and hollow paid artifacts are both instances.
- **The session's timing recommendation:** treat MAST as a **month-2+ candidate** — a 3–4 week rebuild of core value in a crowded category, with **12 visitors in the last 30 days and no demand evidence since April**. Revive only if something (waitlist, outreach, a few hand-sold pilots) shows pull first. "Reviving it now would be the five-products failure mode wearing a new costume."
- Named failure mode to guard against: touching five products, building not finishing.

## Implementation plan

See `thoughts/shared/plans/2026-07-07-myaiskilltutor-rebuild.md`.
