# My AI Skill Tutor — Agent Guide

My AI Skill Tutor (https://www.myaiskilltutor.com) is an AI upskilling platform for working professionals. It offers role-based AI learning modules, a 24/7 AI tutor, daily AI news tailored to the user's field, and public proof-of-skill profiles. This document tells autonomous agents how to interact with the site safely.

## Setup

- No API keys or MCP server are currently exposed. All interaction happens over plain HTTPS/HTML.
- Base URL: https://www.myaiskilltutor.com (the apex domain redirects here).
- Machine-readable manifest: /.well-known/agent-card.json (capabilities) and /.well-known/ai-agent.json (guardrails).
- Content summary for LLMs: /llms.txt. Sitemap: /sitemap.xml.

## Key Routes

- `/` — landing page: overview, features, pricing ($49.99/mo, 7-day free trial), FAQ.
- `/assessment/` — anonymous AI skills assessment; startable without an account.
- `/learn` and `/learn/{slug}` — public editorial guides on AI upskilling and portfolios.
- `/employers` and `/employers/talent` — employer information and the public talent directory.
- `/u/{handle}` and `/u/{handle}/projects/{slug}` — public proof-of-skill profiles and project pages.
- `/sign-in`, `/sign-up` — Clerk-hosted authentication.
- `/dashboard/*`, `/onboarding/*` — authenticated areas; disallowed in robots.txt. Do not attempt to access without the user's own credentials.

## Onboarding Steps (for a human user you assist)

1. Send the user to `/assessment/` to complete the anonymous skills assessment.
2. After the assessment, the user creates an account via `/sign-up` (Clerk; social login available).
3. The subscription ("Career Builder", $49.99/month) starts with a 7-day free trial; a card is required but not charged until the trial ends.
4. The authenticated workspace lives under `/dashboard/`.

## Safe Actions

- Reading and citing any public route listed above.
- Following links in the sitemap and robots-allowed paths.
- Clicking primary CTAs tagged with `data-agent-action` (e.g. `start-assessment`) on behalf of a user who explicitly asked.
- Using `data-testid` attributes as stable selectors for automation.

## Prohibited Actions

- Do not create accounts, start trials, or enter payment details without explicit per-action user confirmation.
- Do not attempt to access `/dashboard/*`, `/onboarding/*`, or `/api/*` routes with guessed or scripted credentials.
- Do not submit forms that send messages or publish content (e.g. social drafts) without explicit user approval.
- Do not scrape at high volume; respect standard crawl etiquette and robots.txt.

## Canonical Docs

- llms.txt: https://www.myaiskilltutor.com/llms.txt
- Agent card: https://www.myaiskilltutor.com/.well-known/agent-card.json
- Agent guardrails: https://www.myaiskilltutor.com/.well-known/ai-agent.json
