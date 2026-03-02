# Verification Checklist

## Browser (Playwright)
Run:

```bash
pnpm test:e2e
```

Validates:
1. Theme toggle persistence.
2. Hero iframe behavior.
3. Legacy copy removal.
4. Matrix-driven onboarding/employer options.
5. Dashboard fail-state visibility.

## CLI Gate
Run:

```bash
pnpm verify:all
```

Includes:
1. env checklist generation
2. lint
3. typecheck
4. unit tests
5. integration tests
6. e2e tests
7. builds
8. migration verification
9. deployment dry-run verification
