# MyDailyDownload — Capability Audit for Absorption into MAST (2026-07-07)

> Provenance: Explore-agent audit of `/Users/miguel/mydailydownload`, run 2026-07-07 while planning the
> MyAISkillTutor rebuild. Decision: **absorb into MAST** — its briefing engine becomes MAST's Phase 3
> retention fuel (landscape monitoring + daily actions); standalone brand retired to top-of-funnel.
> Companion docs: `2026-07-07-myaiskilltutor-product-audit.md`, plan `2026-07-07-myaiskilltutor-rebuild.md`.

## What it is

Two deployable units in one repo (which, notably, lives inside a folder named `Kimi_Agent_AI Skill Tutor MVP`
— same product lineage as PersonalAITutor):

- **`web/`** — Next.js 16 marketing/signup site on Vercel (`mydailydownload-web`, mydailydownload.com):
  landing, 3-step onboarding, **15 SEO career-hub pages** (`web/app/ai-for/[career]/page.tsx`), double-opt-in
  signup → Supabase → Resend (`web/app/api/{subscribe,confirm,unsubscribe,checkout,stripe-webhook}`).
  No LLM calls in the web app.
- **`newsletter-backend/`** — Python engine run by a **live GitHub Actions cron** (`0 11 * * *`, green through
  2026-07-07, `run_daily.py`): fetch → canonicalize → dedupe → rank → grounded summarize → guardrail → email.

## The crown jewel: the briefing engine (~500 LOC, cleanly portable)

- **Sources:** ~35 real RSS feeds in 4 trust tiers (`newsletter-backend/news_feeds.py:16-64`) — OpenAI/Google/
  DeepMind/Meta/NVIDIA/HF blogs, TechCrunch/Verge/VentureBeat/Ars/Wired, arXiv cs.AI/CL/LG, Simon Willison/
  Import AI/The Batch/Lenny's/Latent Space/HN. Env-gated extra lanes: Exa (implemented), Tavily (stub),
  AgentMail newsletter discovery (implemented, inbox `mydailydownload@agentmail.to`).
- **Ranking:** `rank_for_category` (`news_engine.py:313-343`) — career `search_terms` keyword overlap ×
  7-day-half-life recency × cross-feed trending boost × tier trust boost. `build_briefing` (:759-849) →
  Big Story + Quick Hits + Sources.
- **Grounded summarization:** OpenAI `gpt-4o-mini`, JSON mode, temp 0.0, strict "add no facts" editor prompt
  (`news_engine.py:349-404`); discards rewrite if the model alters the URL. **Degrades gracefully:** without
  `OPENAI_API_KEY` it passes real feed text through — the engine runs with zero keys.
- **No-fabrication guardrail (the differentiator):** `validate` (`news_engine.py:425-464`) — every rendered URL
  must exist in the fetched set or the block is dropped; curation blocks are omitted rather than invented.
  KEEP THIS INTACT in any port.
- **Career taxonomy:** 15 flat `{id, name, search_terms}` categories (`config.py:27-43`): product-management,
  marketing, sales, operations, hr-people, design, finance, engineering, data-science, customer-success,
  content-creation, consulting, legal, healthcare, entrepreneurship. Trivially subsettable/mappable to MAST's
  9-path matrix. Web mirror + slug inference: `web/app/lib/careerContent.ts:84-100, :132-175`.

## Honest limits found

- **"Hyper-personalized" = 1-of-15 career category.** Seniority and interests are captured at onboarding but
  NEVER used in generation (`news_engine.py:826` echoes seniority; interests unread). Same-career subscribers
  get identical content. Per-user personalization is exactly the layer MAST adds (profile/score/gaps).
- **Same facade DNA as MAST:** "AI resume/LinkedIn analysis" is a static keyword dictionary client-side; resume
  files are never parsed; the real LLM analyzer (`career_analyzer.py`) is dead code (its prompts at :64-73,
  :98-107 can seed MAST's Phase 1 assessment).
- **Near-zero subscribers:** daily cron completes in ~1 min → almost no confirmed (career, seniority) cells.
  Launched-but-pre-traction. Standalone-newsletter demand: not evidenced.
- Python engine has **no tests**; web has good route/analytics/legal tests.
- Hardcoded: Supabase project ref `wzhnfctutueunirvciol` (`db.py:38`, `db/schema.sql:8`), mydailydownload.com
  domain, Resend-specific mailer; legacy `FROM_EMAIL` default still `newsletter@dailyaiedge.com` (`config.py:15`).
  No secrets in tracked source (verified); real keys live in gitignored `.env` (OpenAI, Exa, AgentMail, Tavily,
  Resend, Supabase, Stripe all populated locally).

## Absorption plan (adopted into MAST rebuild Phase 3)

1. **Port** `news_feeds.py` + `news_engine.py` → TS package `packages/daily-content` in the PersonalAITutor
   monorepo (mechanical: RSS parse + string ranking + one optional OpenAI call). Guardrail preserved verbatim
   in behavior. Run from MAST's existing worker/scheduler; write to MAST's Supabase.
2. **Map** 15 careers → MAST's 9 paths (subset + merge `search_terms`).
3. **Wire** briefings into event-driven re-scoring ("landscape moved → your score moved → today's action")
   and the weekly proof-of-watch report.
4. **Funnel:** repoint the 15 SEO career hubs at MAST's free assessment; newsletter becomes MAST's free tier /
   top-of-funnel. Keep the MDD cron alive until the port ships, then retire the Python engine.
5. **Leave behind:** `career_analyzer.py` (dead), legacy `run.py`/`subscribers.py` (SQLite, 0 rows), branded
   email templates, the sample-content library in `careerContent.ts:252-501` (marketing fiction, not engine output).
