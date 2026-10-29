# Career content and tools release — October 29, 2026

Miguel authorized production publication and live QA using gpt-6.1-terra. His latest instruction resumes shipping and adds tools and further search-led articles.

## Release contents

- Seven editorial guides and the open Career Remapping Workbook, using the existing learning library.
- Five browser exercises: experience mapper, resume evidence builder, career reset planner, proof project planner, and gaming transition mapper.
- Exercises embedded in all eight new learning pages; standalone hub at `/tools/career-remapping`.
- Downloadable exercise notes and seven-page printable PDF at `/downloads/career-remapping-workbook.pdf`.
- Public routes explicitly allow the hub and PDF without an account. Existing private routes stay protected.
- No AI API calls, account creation, resume upload, automatic saving of answers, or added dependencies. Answer/result fields are inside PostHog's `ph-no-capture` subtree.
- Task-word mapping is a limited editorial heuristic. Suggestions show reported tasks and gaps. This is not skill verification, a live vacancy search, or a hiring prediction.

## Validation before publication

- Test-first failures observed for exercises, rendering, and anonymous access; then fixed.
- Full unit suite: 78 files / 934 tests passed. Workspace type checks passed.
- Initial production build passed. Local browser request was blocked by missing Clerk configuration in the isolated checkout; no production secrets were copied. The configured Vercel preview will provide browser verification.
- PDF previously rendered and inspected on all seven pages.
- Private provider reports and search metrics are excluded from the public GitHub repository.

## Publication workflow

Push the approved branch, open a PR against main, wait for the existing Vercel preview and checks, verify that revision, then merge. Verify production against the merge SHA. Only then run the requested gpt-6.1-terra browser QA. Record actual outcomes after readback; a build or HTTP 200 alone does not establish publication.

QA visits use `pb_traffic_type=qa`, `pb_qa_worker=macbook-pro`, a run identifier, `pb_qa_suite`, and QA campaign tags. Do not create accounts, start trials, enter payment data, or submit email. Close only task-owned disposable tabs.

## Routes

- `/learn/ai-skills-for-resume`
- `/learn/my-job-is-disappearing`
- `/learn/career-change-after-gaming-layoff`
- `/learn/how-to-get-a-job-in-the-age-of-ai`
- `/learn/career-mapping-transferable-skills`
- `/learn/transferable-skills-examples`
- `/learn/ai-portfolio-examples`
- `/learn/career-remapping-workbook`
- `/tools/career-remapping`
- `/downloads/career-remapping-workbook.pdf`
