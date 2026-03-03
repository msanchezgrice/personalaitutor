# Environment Variables Instructions

This document lists every environment variable required or recommended for `myaiskilltutor`.

## Where To Set
- Local development: `.env.local` (do not commit)
- Vercel: Project Settings -> Environment Variables
- Environments to set in Vercel: `production`, `preview`, `development`

## Required For MVP Runtime

| Variable | Required | Used By | Exact Format | How To Obtain |
|---|---|---|---|---|
| `PERSISTENCE_MODE` | Yes | API runtime | `supabase` (prod) or `memory` (local-only) | Set manually |
| `SUPABASE_URL` | Yes | API runtime (`apps/web/lib/runtime.ts`) | `https://<project-ref>.supabase.co` | Supabase dashboard -> Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | API runtime writes/reads | Long JWT or `sb_secret_...` | Supabase dashboard -> API Keys -> service role |
| `SUPABASE_ANON_KEY` | Yes | Public anon checks + client-side compatibility | Long JWT or `sb_publishable_...` | Supabase dashboard -> API Keys -> anon/publishable |

## OAuth And Auth

| Variable | Required | Used By | Exact Format | How To Obtain |
|---|---|---|---|---|
| `CLERK_SECRET_KEY` | Yes (when Clerk enabled) | Auth backend integration | `sk_...` | Clerk dashboard -> API Keys |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes (when Clerk enabled) | Auth frontend integration | `pk_...` | Clerk dashboard -> API Keys |
| `LINKEDIN_CLIENT_ID` | Yes for LinkedIn OAuth | `/api/auth/linkedin/start` | App client id string | LinkedIn Developer App settings |
| `LINKEDIN_CLIENT_SECRET` | Yes for LinkedIn OAuth | LinkedIn callback token exchange | Secret string | LinkedIn Developer App settings |
| `LINKEDIN_REDIRECT_URI` | Yes for LinkedIn OAuth | LinkedIn callback validation | `https://<domain>/api/auth/linkedin/callback` | Must exactly match LinkedIn app redirect URI |
| `X_CLIENT_ID` | Yes for X OAuth | `/api/auth/x/start` | App client id string | X Developer Portal |
| `X_CLIENT_SECRET` | Yes for X OAuth | X callback token exchange | Secret string | X Developer Portal |
| `X_REDIRECT_URI` | Yes for X OAuth | X callback validation | `https://<domain>/api/auth/x/callback` | Must exactly match X app redirect URI |

## AI, Email, Deploy Integrations

| Variable | Required | Used By | Exact Format | How To Obtain |
|---|---|---|---|---|
| `OPENAI_API_KEY` | Yes for real AI generation | Agent/content generation paths | `sk-...` | OpenAI dashboard -> API keys |
| `RESEND_API_KEY` | Yes for real emails | Daily updates + fail-state alerts | `re_...` | Resend dashboard -> API keys |
| `VERCEL_TOKEN` | Needed for CI deploy automation | Scripts/deploy pipeline | Vercel personal/team token | Vercel settings -> Tokens |
| `RENDER_API_KEY` | Needed only if worker deploys via Render | Worker deploy automation | Render API token | Render dashboard -> API keys |

## Worker Runtime (Optional Overrides)

| Variable | Required | Used By | Default |
|---|---|---|---|
| `WORKER_ID` | Optional | Worker identity | `worker-1` |
| `CLAIM_LIMIT` | Optional | Job claim batch size | `5` |
| `WORKER_POLL_MS` | Optional | Queue poll interval | `3000` |
| `SCHEDULER_POLL_MS` | Optional | Scheduler interval | `60000` |
| `DEFAULT_USER_ID` | Optional | Fallback user id for scripts | `user_test_0001` |

## Exact Redirect URI Values (Production)
- `LINKEDIN_REDIRECT_URI=https://myaiskilltutor.com/api/auth/linkedin/callback`
- `X_REDIRECT_URI=https://myaiskilltutor.com/api/auth/x/callback`

## Validation Checklist
1. `PERSISTENCE_MODE=supabase` in Vercel for all environments.
2. `SUPABASE_URL` and keys point to the same Supabase project.
3. LinkedIn/X redirect URIs in provider dashboards exactly match env values.
4. Run `pnpm verify:all` locally before deploy.
5. After deploy, test:
   - `/api/onboarding/start`
   - `/api/assessment/start`
   - `/api/profile/publish`
   - `/api/employers/talent`

## Current Placeholder Policy
Placeholders are currently set in Vercel for missing keys so deploys do not fail on missing-variable checks. Replace placeholder values before production go-live.
