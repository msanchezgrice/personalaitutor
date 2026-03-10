# Authenticated Playwright Dashboard Checks

Purpose: verify signed-in dashboard behavior after a push, not just public/auth-gate pages.

## Live production check

Run:

```bash
pnpm test:e2e:live:auth
```

What it does:

- ensures a dedicated Clerk E2E user exists
- signs in through Clerk using the official `@clerk/testing/playwright` helper
- saves auth state to `playwright/.clerk/dashboard-user.json`
- verifies:
  - dashboard FTUE content
  - `Start Recommended Work` opens the module workbench
  - Projects shows the module workbench
  - Activity shows user-visible actions

Defaults:

- test user email: `playwright+dashboard@myaiskilltutor.dev`
- override with `E2E_CLERK_USER_EMAIL`

Required env:

- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

## Local check

Run:

```bash
PLAYWRIGHT_ALLOW_LOCAL_CLERK_AUTH=1 pnpm test:e2e:auth
```

Local auth is opt-in because Clerk must be configured to allow `http://localhost:6396`.
If localhost is not allowed in the Clerk instance, the local auth suite skips.
