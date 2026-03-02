# Deploy Playbook

## Default deployment
1. Push to `main` for production Vercel deployment through existing GitHub integration.
2. Use pull requests for preview deploys.
3. Avoid claimable Vercel project creation flow unless explicitly requested.

## Worker deployment
1. Build worker: `pnpm --filter @aitutor/worker build`
2. Deploy worker service on Render with environment keys matching checklist.
3. Confirm scheduler and queue loops are healthy in logs.

## Rollback
1. Revert failing commit in GitHub and redeploy via integration.
2. Disable scheduler endpoints if provider failures spike.
3. Keep fail-state notifications enabled so users see explicit recovery actions.
