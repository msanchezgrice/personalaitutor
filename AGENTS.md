# AGENTS.md

## What this product is

My AI Skill Tutor (https://www.myaiskilltutor.com) is an AI upskilling platform for working professionals. It provides role-based AI learning modules, a 24/7 AI tutor, daily AI news filtered to the user's field, and public proof-of-skill profiles that employers can inspect. There is one plan ("Career Builder", $49.99/month) with a 7-day free trial.

## Repository layout

- `apps/web` — Next.js app served at myaiskilltutor.com (App Router). Static assets served from `apps/web/public`. Landing pages are rendered from HTML templates in `mockups/high_fidelity/` via `apps/web/components/gemini-static-page.tsx`.
- `apps/worker` — background worker (see `docs/render_worker_setup.md`).
- `packages/shared`, `packages/daily-content` — shared libraries.
- `supabase/migrations` — database migrations.
- `tests/` — unit, integration, e2e, and live Playwright/Vitest suites.
- `docs/` — deploy playbooks, env variable instructions, checklists.

## Key routes (production)

- `/` — landing page (features, pricing, FAQ; FAQPage/Organization/WebSite JSON-LD emitted).
- `/assessment/` — anonymous AI skills assessment (no account required to start).
- `/learn`, `/learn/{slug}` — public AI upskilling guides.
- `/employers`, `/employers/talent` — employer info and public talent directory.
- `/u/{handle}`, `/u/{handle}/projects/{slug}` — public proof-of-skill profiles.
- `/sign-in`, `/sign-up` — Clerk authentication.
- `/dashboard/*`, `/onboarding/*` — authenticated; disallowed in robots.txt.

## How agents should interact

- Read `apps/web/public/llms.txt` (served at /llms.txt) for a content map and `apps/web/public/agents.md` (served at /agents.md) for onboarding steps, safe actions, and prohibited actions.
- Machine-readable manifests live in `apps/web/public/.well-known/agent-card.json` and `apps/web/public/.well-known/ai-agent.json` (guardrails).
- Primary CTAs carry `data-testid` and `data-agent-action` attributes; use them as stable selectors.
- Never automate account creation, trial start, payment entry, or content publishing without explicit per-action user confirmation.

## Conventions for coding agents

- Package manager: pnpm 10 (workspace). Do not commit, push, or mutate git history without explicit approval.
- Typecheck: `pnpm typecheck`. Unit tests: `pnpm test`. E2E: `pnpm test:e2e` (Playwright).
- Shared stylesheet for the static-template pages: `apps/web/public/styles.css`. Global focus visibility uses a `:focus-visible` outline rule defined there.
- Security headers (CSP with `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS) are set centrally in `apps/web/next.config.ts`.
- The landing templates in `mockups/high_fidelity/` are served to production users; do not change visible above-the-fold content or pre-purchase funnel surfaces when editing them.
