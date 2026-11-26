# AGENTS.md

## What this product is

My AI Skill Tutor (https://www.myaiskilltutor.com) helps working professionals move into AI-era jobs. The promise: your experience isn't obsolete, it's unmapped.

- **Career map** (free, no account): paste or upload a résumé, or describe your last job, and get one new title from a fixed catalog, two alternates, 3-6 skill translations each backed by a verbatim quote from the input, the gaps to close, and a three-piece proof plan. Every map has a shareable page at `/map/{token}`. A map is a starting hypothesis, not a hiring prediction.
- **Proof Studio** (paid): three public pieces that back up the new title: a **site** (`/u/{handle}`), a **voice model** tuned *in context* on the learner's own writing (voice profile + examples in context, not fine-tuned; visitors compare it with the untuned model), and a **build log** of short public posts.
- **Remapped** (public): a library of career routes (old job -> new title), one new route each week.
- The existing product keeps working: role-based weekly plan and modules, a 24/7 AI tutor, daily AI news filtered to the user's field, and the anonymous AI-readiness assessment.

There is one plan ("Career Builder", $49.99/month) with a 7-day free trial; a card is required to start the trial.

## Repository layout

- `apps/web` — Next.js app served at myaiskilltutor.com (App Router). Static assets served from `apps/web/public`. The home page (`app/page.tsx`), `/map`, `/remapped` and the Proof Studio surfaces are React server components on the `rm-` design system; older marketing and dashboard pages are still rendered from HTML templates in `mockups/high_fidelity/` via `apps/web/components/gemini-static-page.tsx`.
- `apps/worker` — background worker (see `docs/render_worker_setup.md`).
- `packages/shared`, `packages/daily-content` — shared libraries.
- `supabase/migrations` — database migrations.
- `tests/` — unit, integration, e2e, and live Playwright/Vitest suites.
- `docs/` — deploy playbooks, env variable instructions, checklists.

## Key routes (production)

- `/` — landing page (features, pricing, FAQ; FAQPage/Organization/WebSite JSON-LD emitted).
- `/map` — free career map input (paste, upload or describe); `/map/{token}` — a map result (noindex, shareable by link).
- `/remapped`, `/remapped/{slug}` — public library of career routes.
- `/assessment/` — anonymous AI skills assessment (no account required to start).
- `/learn`, `/learn/{slug}` — public AI upskilling guides.
- `/employers`, `/employers/talent` — employer info and public talent directory.
- `/u/{handle}`, `/u/{handle}/projects/{slug}`, `/u/{handle}/log/{slug}` — public proof pages (site, voice model, build log posts).
- `/sign-in`, `/sign-up` — Clerk authentication. `/sign-up?from=map` explains what happens to a saved map.
- `/dashboard/*`, `/onboarding/*` — authenticated and billing-gated; disallowed in robots.txt. Includes `/dashboard/map` (the learner's career map) and `/dashboard/proof` (Proof Studio hub) with `/dashboard/proof/site`, `/dashboard/proof/model` and `/dashboard/proof/log`.
- `/api/career-map/*` — anonymous career map API (rate limited per hashed IP); `/api/voice-models/public/*` — public voice model runs (rate limited). Every other `/api/*` route needs a signed-in user.

## How agents should interact

- Read `apps/web/public/llms.txt` (served at /llms.txt) for a content map and `apps/web/public/agents.md` (served at /agents.md) for onboarding steps, safe actions, and prohibited actions.
- Machine-readable manifests live in `apps/web/public/.well-known/agent-card.json` and `apps/web/public/.well-known/ai-agent.json` (guardrails).
- Primary CTAs carry `data-testid` and `data-agent-action` attributes; use them as stable selectors.
- Never automate account creation, trial start, payment entry, or content publishing without explicit per-action user confirmation. Publishing a Proof Studio piece (site, voice model, build log post) is content publishing.

## Conventions for coding agents

- Package manager: pnpm 10 (workspace). Do not commit, push, or mutate git history without explicit approval.
- Typecheck: `pnpm typecheck`. Unit tests: `pnpm test`. E2E: `pnpm test:e2e` (Playwright).
- Shared stylesheet for the static-template pages: `apps/web/public/styles.css`. Global focus visibility uses a `:focus-visible` outline rule defined there.
- Security headers (CSP with `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS) are set centrally in `apps/web/next.config.ts`.
- The templates in `mockups/high_fidelity/` are served to production users; do not change visible above-the-fold content or pre-purchase funnel surfaces when editing them.
- **Career map + Proof Studio (2026-11-25).** The plan and its honesty rules live in `thoughts/shared/plans/2026-11-25-career-map-proof-studio.md`, the codebase notes in `thoughts/shared/research/2026-11-25-career-map-recon.md`, and the approved designs in `thoughts/shared/design/2026-11-25-remap/`. Contracts are in `packages/shared/src/career-map.ts` and `packages/shared/src/proof-studio.ts`.
- **Honesty rules.** No invented statistics, customers, testimonials or user counts. The example person (Maya Ortiz / Kiteborne Games) is fictional and labelled "Example" wherever she appears. The voice model is described as tuned in context (`VOICE_MODEL_METHOD_LABEL`). LLM failures are hard failures with a clear error and retry, never placeholder content.
- **`rm-` design system.** New public and dashboard surfaces use `apps/web/app/remap.css` (imported once in `app/layout.tsx`). Wrap content in `<div className="rm">` (inside `DashboardShell`, use `<div className="rm" style={{ minHeight: 0, background: "transparent" }}>`), use `rm-` classes plus a small CSS module for layout, and do not mix legacy Tailwind utilities into rm pages. `--rm-green` is for lines and fills only; use `--rm-green-deep` for green text and buttons. Shared pieces: `components/remap/*` (`RemapSiteHeader`, `RouteMap`, `TranslationList`, `RouteStrip`) and `components/dashboard/route-*` (dashboard career map, Proof Studio hub, "Your route" card).
- **Seed files.** A file whose first line says `FOUNDATION-SEED` fixes exported signatures for parallel work; its owner replaces the body and deletes the marker. A build must never ship with a surviving marker (`grep -rn FOUNDATION-SEED apps packages`).
- **Funnel events.** Persisted funnel event names are registered in `apps/web/lib/funnel-events.ts` (Set + union) and counted in `apps/web/lib/admin-analytics.ts`. Client code sends them with `captureAnalyticsEvent` from `@/lib/analytics`.
- **Linking anonymous work.** Maps drawn before sign-up are linked to the learner by `linkCareerMapsForLearner` (`apps/web/lib/career-map-linking.ts`: the `mast_cm` cookie; same-email linking is switched off), beside `linkAnonymousAssessmentsToProfile`, on dashboard load and in the onboarding claim/complete routes. Both are failure-isolated: they log and never throw.
- **Anonymous funnel rules (security review, 2026-11-25).** A map link is meant to be shared, so holding the token grants reading the map and nothing else: only the browser with the `mast_cm` cookie for that map can save an email on it, an email is set once, and maps attach to accounts by cookie only (`CAREER_MAP_LINK_BY_EMAIL` is off until there is a confirm-by-email step). Public endpoints that call the model record the attempt first and count after, so limits hold under parallel requests. `POST /api/career-map` accepts same-site JSON only. Map tokens are redacted from analytics (`redactPrivatePath`). QA findings and the production walk script are in `thoughts/shared/qa/2026-11-25-launch/`.
- **Dashboard pages.** Each `/dashboard/*` page renders its own `DashboardShell` (pattern: `app/dashboard/social/page.tsx`) and must be registered in `public/gemini-runtime.js` `hydrateCurrentPath`, or the runtime redirects it to `/dashboard/`.
