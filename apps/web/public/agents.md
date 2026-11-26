# My AI Skill Tutor: Agent Guide

My AI Skill Tutor (https://www.myaiskilltutor.com) helps working professionals find the AI-era job their experience fits and prove it in public. The free career map turns a résumé into a new job title with the evidence behind it. The paid plan adds Proof Studio (a public site, a voice model tuned in context on the person's own writing, and a build log) alongside learning modules, a 24/7 AI tutor and daily AI news. This document tells autonomous agents how to interact with the site safely.

## Setup

- No API keys or MCP server are exposed to agents. All interaction happens over plain HTTPS/HTML.
- Base URL: https://www.myaiskilltutor.com (the apex domain redirects here).
- Machine-readable manifest: /.well-known/agent-card.json (capabilities) and /.well-known/ai-agent.json (guardrails).
- Content summary for LLMs: /llms.txt. Sitemap: /sitemap.xml.

## Key Routes

- `/` — landing page: the launch film, how the career map works, Proof Studio, pricing ($49.99/month after a 7-day free trial), FAQ.
- `/map` — free career map, no account. Three ways in: paste a résumé, upload one (PDF, DOCX or TXT), or describe a past job. Generation takes about 10 to 30 seconds.
- `/map/{token}` — one person's career map result. A private link; disallowed in robots.txt. Do not share, index or republish it.
- `/remapped` and `/remapped/{slug}` — public library of career routes (old job to AI-era title), one new route every Monday.
- `/u/{handle}` — public proof pages: new title, skill translations, things built, a "Try my model" voice model comparison, and build log posts.
- `/u/{handle}/log/{slug}` and `/u/{handle}/projects/{slug}` — build log posts and project pages.
- `/assessment/` — anonymous AI skills assessment; startable without an account.
- `/learn` and `/learn/{slug}` — public editorial guides on AI upskilling, career changes and portfolios.
- `/employers` and `/employers/talent` — employer information and the public talent directory.
- `/sign-in`, `/sign-up` — Clerk-hosted authentication.
- `/dashboard/*`, `/onboarding/*` — authenticated areas (career map, Proof Studio, learning plan, tutor, news); disallowed in robots.txt. Do not attempt to access without the user's own credentials.

## Onboarding Steps (for a human user you assist)

1. Send the user to `/map` to get their free career map. They paste, upload or describe their own experience. Confirm with the user before you submit any résumé text or file for them.
2. The result page shows their new title, two alternates, skill translations with the résumé line behind each, gaps and a proof plan. It is a starting hypothesis, not a hiring prediction.
3. To build the proof (site, voice model, build log), the user creates an account via `/sign-up` and starts the Career Builder plan: $49.99/month with a 7-day free trial. A card is required to start the trial and is not charged if the user cancels before the trial ends.
4. The workspace lives under `/dashboard/`. Proof Studio is at `/dashboard/proof`. Nothing becomes public until the user publishes it.

## Stable Selectors

Home page calls to action carry `data-testid` attributes, and primary CTAs also carry `data-agent-action` (links to the career map use `start-career-map`):

- `cta-map-career-nav` — header link to the career map.
- `cta-map-career-hero` — hero "map my career" action.
- `cta-upload-resume-hero` — hero link to upload a résumé.
- `cta-play-film` — plays the launch film.
- `cta-map-career-pricing` — free plan card, to the career map.
- `cta-start-trial-pricing` — paid plan card, starts sign-up for the 7-day free trial.
- `cta-map-career-bottom` — final call to action, to the career map.

Remapped pages also carry `cta-map-career-remapped` (index) and `cta-map-career-route` (route pages), both linking to `/map`.

## Safe Actions

- Reading and citing any public route listed above, including Remapped routes and published proof pages.
- Following links in the sitemap and robots-allowed paths.
- Opening `/map` and helping the user prepare their text, then submitting it only after the user confirms.
- Using `data-testid` attributes as stable selectors for automation.

## Prohibited Actions

- Never submit a résumé, file or job description to the career map without the user's explicit confirmation for that submission.
- Never create accounts, start trials or enter payment details without explicit per-action user confirmation.
- Never publish a proof site, voice model or build log post, or send any message, without the user's explicit approval for that action.
- Do not run another person's résumé through the career map, and do not share someone's `/map/{token}` link.
- Do not access `/dashboard/*`, `/onboarding/*` or `/api/*` routes with guessed or scripted credentials.
- Do not scrape at high volume; respect standard crawl etiquette and robots.txt.

## Canonical Docs

- llms.txt: https://www.myaiskilltutor.com/llms.txt
- Agent card: https://www.myaiskilltutor.com/.well-known/agent-card.json
- Agent guardrails: https://www.myaiskilltutor.com/.well-known/ai-agent.json
