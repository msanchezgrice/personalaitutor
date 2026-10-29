# Career content release checkpoint — October 29, 2026

User authorized publishing and subsequent live QA with **gpt-6.1-terra**. That authorization remains valid. Publication is temporarily held by the recovery coordinator because the Mac's free disk is rapidly falling. No PR was pushed, no production merge or deployment occurred, and no Terra QA agent was launched.

## Saved implementation

- Five full guides plus the open workbook, integrated through `apps/web/lib/career-learn-content.ts` and the existing `/learn/[slug]` route.
- Accessible structured tables, lists, quotes, inline emphasis, separate search titles, and workbook calls to action.
- Seven-page printable PDF at `apps/web/public/downloads/career-remapping-workbook.pdf`; all pages rendered and visually inspected, with text present on all seven pages.
- Existing roadmap and proof guide strengthened; career collection and `llms.txt` link the new material. Existing nine guides remain present.
- Source manuscripts and reproducible conversion/PDF scripts are saved. Private search metrics are excluded from the publishing commit; original local research remains at `/Users/miguel/PersonalAITutor/docs/content/2026-10-29-career-remapping/search-review.md`.

## Verification already completed

- Test-first failures observed for missing structured rendering, metadata/resource support, and missing career routes/assets; implementation then passed the five focused tests.
- `pnpm typecheck`: passed across workspace packages.
- Full unit suite: **76 files / 928 tests passed**. The final subsequent edits were content, links, and wrapping classes; focused content/rendering tests passed again afterward.
- `git diff --check`: passed before the checkpoint.
- Production build, preview, browser checks, production deployment, and live QA: **not run**. No credentials or ignored environment files were copied into the checkout.

## Resume after resource admission

Checkout: `/Users/miguel/.codex/worktrees/tutor-career-content/PersonalAITutor`; branch `codex/career-remapping-content`; base `origin/main` at `dbe0134cdf2bc530c5a647370bbefd4a91ef28f7` when created. The checkpoint commit is identified in the chat and Git log.

1. Confirm the recovery hold is lifted and recheck remote main for changes. Preserve other worktrees and their work.
2. Next validation command from this checkout: `pnpm --filter @aitutor/web build`. Use approved resource scheduling; do not start duplicate builds or servers. A Vercel PR preview can provide remote build evidence if that route is admitted.
3. Review the final diff, push this branch, open a PR against main, wait for the existing Vercel preview/check, and inspect the exact revision. User's October 29 approval covers this release; do not create a new Vercel project or claimable deployment.
4. Merge through GitHub after checks pass. Verify the production deployment is tied to the merge revision, then verify these live routes and the PDF. Reachability alone is not revision proof.
5. Only after live deployment, spawn one QA subagent using model `gpt-6.1-terra` as requested. Read the user AGENTS instructions and QA skill. Use an isolated browser/context; tag first and subsequent same-origin visits with `pb_traffic_type=qa`, `pb_qa_worker=macbook-pro`, an opaque run ID, and `pb_qa_suite`, plus the prescribed QA UTMs when absent. Check desktop/mobile readability, table scrolling, canonicals, structured data, hub/sitemap inclusion, internal links, assessment destinations, and actual PDF download. Avoid signup, trial, payment, email submission, or modifications. Close only task-created tabs.

Expected public routes, **not yet live from this branch**:

- `/learn/ai-skills-for-resume`
- `/learn/my-job-is-disappearing`
- `/learn/career-change-after-gaming-layoff`
- `/learn/how-to-get-a-job-in-the-age-of-ai`
- `/learn/career-mapping-transferable-skills`
- `/learn/career-remapping-workbook`
- `/downloads/career-remapping-workbook.pdf`

No ready AgentBox checkout/dependency/data path for this exact project has been verified. No remote transfer, install, secret copy, or heavy remote job was started.
