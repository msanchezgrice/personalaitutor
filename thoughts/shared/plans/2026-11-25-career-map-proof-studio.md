# Career Map + Proof Studio: build plan (2026-11-25)

Owner asked for: rebuild the landing page from the launch film ("The Missing Map") and ship the product that
matches its promise, end to end, live. No stubs, no placeholders.

Read first, in this order:
1. This file.
2. `thoughts/shared/research/2026-11-25-career-map-recon.md` (how the existing code works: LLM client, dual-mode
   stores, auth, billing gate, dashboard shell, tests, CSP, gotchas).
3. `thoughts/shared/design/2026-11-25-remap/{Main,CareerMap,Proof}.dc.html` (the approved designs: landing page,
   career map result, public proof page). Treat their copy and structure as the spec; translate the inline styles
   into the `rm-` design system (`apps/web/app/remap.css`) plus small CSS modules.
4. The shared contracts: `packages/shared/src/career-map.ts`, `packages/shared/src/proof-studio.ts`.

## The product

**Promise (from the film):** your experience isn't obsolete, it's unmapped. Tell us what you did before; we map it
to the AI-era job it fits; then we help you prove it in public.

| Piece | Who | What |
| --- | --- | --- |
| Career map | Free, no account | Paste/upload a résumé (or describe your last job) -> one new title from a fixed catalog, two alternates, 3-6 skill translations each backed by a verbatim résumé quote, the gaps, and a three-piece proof plan. Shareable page at `/map/{token}`. |
| Proof Studio | Career Builder plan ($49.99/mo, 7-day free trial, card required: unchanged) | Three public proof pieces: **Site** (`/u/{handle}`), **Voice model** (tuned in context on the learner's own writing; visitors compare it with the untuned model), **Build log** (short public posts). |
| Remapped | Public | A library of career routes (old job -> new title), one new route each week. `/remapped`. |
| Existing product | Unchanged | Weekly plan/modules, 24/7 tutor, daily AI news, assessment at `/assessment` all keep working. |

Honesty rules (non-negotiable):
- Never invent statistics, customers, testimonials or user counts. The only stats allowed on public pages are the
  three sourced ones in the design (GDC 2026 "1 in 3", WEF 2025 "170M", PwC 2026 "62%"), each shown with its source.
- Maya Ortiz / Kiteborne Games is a fictional example. Wherever she appears, the page says "Example".
- The voice model is tuned **in context** (voice profile + examples), not fine-tuned. Say so wherever the model is
  described (`VOICE_MODEL_METHOD_LABEL`).
- A career map is "a starting hypothesis, not a hiring prediction". Keep that line on the result page.
- LLM failure is a hard failure with a clear error and retry. Never show placeholder or fabricated content.
- Do not use the owner's name anywhere public.

## Foundation (already on the branch: do not rewrite)

- `packages/shared/src/career-map.ts`: title catalog (`CAREER_MAP_TITLES`, 33 titles on 5 lines), `careerMapSchema`,
  `CareerMapRecord`, `CareerMapView`, `toCareerMapView`, `isEvidenceGrounded`, `EXAMPLE_CAREER_MAP(_INPUT)`,
  `CAREER_MAP_COOKIE_NAME`, input limits.
- `packages/shared/src/proof-studio.ts`: `ProofSite`, `proofSiteDraftSchema`, `VoiceModel*`, `voiceStyleProfileSchema`,
  `BuildLogPost*`, `buildLogDraftSchema`, `RemappedRoute`, `ProofPieceStatus`, limits.
- `supabase/migrations/20261126030000_add_career_map_and_proof_studio.sql`: tables `career_maps`, `proof_sites`,
  `voice_models`, `voice_model_samples`, `voice_model_runs`, `build_log_posts`. RLS on, no policies, service role only.
  If you truly need another column, tell the integrator in your final report instead of editing the migration.
- `apps/web/app/remap.css` (imported once in `app/layout.tsx`): the `rm-` design system. Wrap every new page in
  `<div className="rm">`. Do not mix legacy Tailwind utility classes into rm pages; write a CSS module for
  page-specific layout. Fonts (Outfit, Inter) are already loaded globally.
- `apps/web/components/remap/site-chrome.tsx` (`RemapSiteHeader`, `RemapSiteFooter`, `RemapBrand`),
  `route-map.tsx` (`RouteMap`), `translation-list.tsx` (`TranslationList`, `RouteStrip`).
- `apps/web/lib/career-map/constants.ts`: sign-up hrefs, the hero-draft sessionStorage key, launch film paths.
- `apps/web/public/video/the-missing-map-720p.mp4` + `the-missing-map-poster.jpg`.
- `apps/web/proxy.ts`: `/map(.*)`, `/remapped(.*)`, `/video/(.*)`, `/api/career-map(.*)`,
  `/api/voice-models/public/(.*)`, `/llms.txt`, `/agents.md`, `/.well-known/(.*)` are public. Everything else under
  `/api` needs a signed-in user. **Do not edit proxy.ts**; if you need another public route, report it.
- Dashboard: nav items "Career Map" (`/dashboard/map`) and "Proof Studio" (`/dashboard/proof`) exist in
  `dashboard-runtime-shell.tsx` (`activeTab="map" | "proof"`); `gemini-runtime.js` and `theme-script.ts` treat
  `/dashboard/map*` and `/dashboard/proof*` as server-rendered pages. **Do not edit those three files.**
- **Seed files.** Files whose first line says `FOUNDATION-SEED` fix the signatures other workstreams compile
  against. The owning workstream replaces the body with the real implementation, keeps every exported signature,
  and deletes the marker. Nobody else edits them. The integrator fails the build if any marker survives.

## Conventions

- Package manager pnpm 10. This machine has 2 cores and 7 GB shared by eight agents: run `tsc`, the full test
  suite and any `next dev`/`next build` through the lock: `scripts/heavy.sh pnpm typecheck`,
  `scripts/heavy.sh pnpm test`. Single-file vitest runs (`pnpm vitest run tests/unit/<file>`) do not need the lock.
  Do not run `next build` (the integrator does). If you start a dev server, use your assigned port, keep it short
  and kill it before you finish.
- TDD where it is cheap: unit tests in `tests/unit/*.test.ts` (node env, `.ts` only; render components with
  `renderToStaticMarkup` as existing tests do). Keep the existing suite green (935 tests at the start).
- New server code goes in new modules under `apps/web/lib/<area>/` starting with `import "server-only"`. Do not
  grow `apps/web/lib/runtime.ts`. Stores follow the dual-mode pattern (memory | supabase) from
  `apps/web/lib/anonymous-assessment.ts`, with a `reset*StateForTests()` export.
- API routes: zod-validate bodies, return `jsonOk` / `jsonError` (`{ ok, error: { code, message } }`), wrap in
  try/catch, set `export const maxDuration = 120` on anything that calls the LLM. Paid routes use
  `requireBillingAccess` (pattern: `app/api/daily-action/route.ts`).
- LLM: `callOpenAiResponses` via `@/lib/openai-responses`, `textFormat: { type: "json_object" }`, strip fences, zod
  `safeParse`, throw `<FEATURE>_INVALID_OUTPUT:<path>`; map `OPENAI_API_KEY_MISSING` to `OPENAI_CONFIG_MISSING`.
- Client analytics: `captureAnalyticsEvent(name, props)` from `@/lib/analytics`. Event names are fixed below.
- Accessibility: real `<button>`/`<a>`/`<label>`; visible focus; text contrast 4.5:1 (`--rm-green` is for lines and
  fills only, use `--rm-green-deep` for text and buttons); every page works at 360px wide; respect reduced motion.
- Copy: plain, short sentences. No "unlock", "seamless", "supercharge", "game-changer". No emoji.
- Links to routes owned by another workstream: plain `<a href>` (typedRoutes rejects unknown `<Link>` targets).
- Git: work only inside your worktree, commit to your branch as you go (small commits), never push, never touch
  another workstream's files. End commit messages with the two attribution lines given in your brief.

## Funnel events (names are fixed)

`career_map_started`, `career_map_completed`, `career_map_failed`, `career_map_viewed`,
`career_map_email_captured`, `career_map_signup_clicked`, `proof_site_published`, `voice_model_tuned`,
`voice_model_published`, `voice_model_public_run`, `build_log_published`, `remapped_route_viewed`.
Workstream H registers them for server-side persistence; everyone else just calls `captureAnalyticsEvent`.

## Workstreams and file ownership

Each workstream owns the listed paths exclusively (plus its own tests under `tests/unit/` with the given prefix).

### A. Career map engine (`remap/a-engine`)
Owns: `apps/web/lib/career-map/*` (except `constants.ts`), `apps/web/app/api/career-map/**`, `apps/web/package.json`
+ `pnpm-lock.yaml` (only A may add dependencies), tests `career-map-engine-*`, `tests/live/career-map.live.test.ts`.
- `store.ts`: real dual-mode implementation of the seeded signatures.
- `generate.ts`: `generateCareerMap({ inputText }): Promise<{ map: CareerMap; model: string }>`. Prompt lists the
  full title catalog (id, title, line, blurb) and the JSON shape. After zod parse: drop translations whose
  `evidence` fails `isEvidenceGrounded`; if fewer than 3 remain, retry once with a stricter instruction; still
  short -> throw `CAREER_MAP_INVALID_OUTPUT:UNGROUNDED`. `before`/`now` must not introduce numbers that are not in
  the input. Use the first 12,000 characters of the input in the prompt.
- `resume-extract.ts`: PDF (`unpdf`), DOCX (`mammoth`), TXT -> text. Max 5 MB. Legacy `.doc` is rejected with a
  clear message. Scanned PDFs with no text -> `RESUME_TEXT_NOT_FOUND`.
- `rate-limit.ts`: `hashRequestIp(req)` (sha256 of ip + a server secret; never store raw IPs) and
  `checkCareerMapRateLimit(ipHash)` using `countRecentCareerMaps`: 5/hour and 15/day per IP hash, 1500/day
  globally; each overridable by env (`CAREER_MAP_LIMIT_HOUR`, `_DAY`, `_GLOBAL_DAY`).
- `email.ts`: `sendCareerMapEmail({ to, map, mapUrl })` via Resend (pattern: `lib/assessment-report-email.ts`).
- Routes:
  - `POST /api/career-map` body `{ text, source: "paste"|"upload"|"describe", visitorId? }` ->
    `{ ok, token, mapPath: "/map/<token>", view: CareerMapView }`. Sets httpOnly cookie `CAREER_MAP_COOKIE_NAME`
    (30 days, sameSite lax, secure in production). If the caller is signed in, link the map to their profile.
    Errors: 400 `INVALID_BODY`, 400 `CAREER_MAP_INPUT_TOO_SHORT`, 429 `CAREER_MAP_RATE_LIMITED`
    (`retryAfterSeconds`), 502 `OPENAI_CONFIG_MISSING` | `CAREER_MAP_FAILED` (`reason`, `recoveryAction`).
  - `POST /api/career-map/extract` multipart `file` -> `{ ok, text, chars, truncated }`. Errors: 413
    `RESUME_FILE_TOO_LARGE`, 415 `RESUME_FILE_UNSUPPORTED`, 422 `RESUME_TEXT_NOT_FOUND`.
  - `GET /api/career-map/[token]` -> `{ ok, view }` | 404 `CAREER_MAP_NOT_FOUND`.
  - `POST /api/career-map/[token]/email` body `{ email }` -> `{ ok, captured: true, emailed: boolean, mapPath }`.

### B. Landing page (`remap/b-landing`)
Owns: `apps/web/app/page.tsx`, `apps/web/components/landing/**`, `apps/web/components/home-page-tracking.tsx`,
tests `landing-*` plus the existing `tests/unit/landing-page-copy.test.ts`,
`tests/unit/assessment-cta-routing.test.ts`, `tests/e2e/hard-gate.spec.ts`, `tests/e2e/landing-header.spec.ts`
(rewrite them for the new page; keep the "no cryptographic claims", light theme and sticky-header checks).
- Implement `Main.dc.html` as React server components + small client islands using the rm system.
- Hero form (client): on submit store `{ text, source: "paste" }` under `CAREER_MAP_DRAFT_STORAGE_KEY` in
  sessionStorage and go to `/map?from=home`. "Upload résumé" links to `/map?upload=1`. Empty text -> `/map`.
- Launch film: `<video controls preload="none" poster>` from the constants, with a play button overlay.
- Hero map: the full network illustration from the design as inline SVG, with a CSS draw-on animation.
- "Remapped" section lists `listRemappedRoutes().slice(0, 5)` (hidden when empty) and links to `/remapped/<slug>`.
- Keep: signed-in header state (`getAuthSeed`), `HomePageTracking` (update selectors: `landing_cta_clicked` for
  links to `/map`), Organization + WebSite + FAQPage JSON-LD (new FAQs from the design), featured learn guides.
- Stable selectors: `data-testid="cta-map-career-hero"`, `cta-map-career-nav` (header), `cta-upload-resume-hero`,
  `cta-start-trial-pricing`, `cta-map-career-pricing`, `cta-map-career-bottom`, `cta-play-film`; each primary CTA
  also carries `data-agent-action`.
- New metadata: title "Find Your New Job Title for the AI Era | My AI Skill Tutor"; description from the hero.
- Pricing trial CTA: `CAREER_MAP_SIGNUP_HREF` signed out, `/dashboard/proof` signed in.
- Check first paint: `/` is in the theme script's "hold for styles" list. Make sure the new page is not hidden
  behind the first-paint loader longer than the old one (verify in a real browser).

### C. Map pages (`remap/c-map`)
Owns: `apps/web/app/map/**`, `apps/web/components/career-map/**`, `apps/web/app/api/og/map/**`, tests `career-map-ui-*`.
- `/map`: input page. Three ways in: paste, upload (calls `/api/career-map/extract`, then shows the extracted text
  for review), describe. Character counter against the shared limits. On submit `POST /api/career-map`, show a
  real progress state (it takes 10-30 s), then `router.push(mapPath)`. Reads the hero draft (see constants) and
  auto-starts when `?from=home`. Handles every error code with a human sentence and a retry.
- `/map/[token]`: server page per `CareerMap.dc.html`. `findCareerMapByToken` from the store, `notFound()` if
  missing, `robots: noindex`. Sections: title + fit chip + "Backed by N lines of your résumé", `RouteMap`,
  translations (quote, now, explanation), two alternates, gaps, proof plan with CTA
  (`CAREER_MAP_SIGNUP_HREF` signed out / `CAREER_MAP_SIGNED_IN_HREF` signed in), "Keep this map" email form
  (hidden when `hasEmail` or signed in), copy-link button, the hypothesis disclaimer.
  Status `generating`/`failed` render their own states.
- `GET /api/og/map/[token]`: 1200x630 PNG via `next/og` (new title, old title, route line). Wire into metadata.
- Develop against `EXAMPLE_CAREER_MAP`; mock `@/lib/career-map/store` in tests (A implements it in parallel).

### D. Proof site (`remap/d-site`)
Owns: `apps/web/lib/proof/*`, `apps/web/app/api/proof/**`, `apps/web/app/dashboard/proof/site/**`,
`apps/web/app/u/[handle]/page.tsx`, `apps/web/app/u/public-profile-utils.ts`, `apps/web/components/proof/site-*`,
`apps/web/components/proof/example-*`, tests `proof-site-*` and existing public-profile tests.
- `site-store.ts` (real), `site-draft.ts` (`draftProofSite({ map, profile })` -> `ProofSiteDraft`).
- Routes (billing-gated): `GET /api/proof/site` -> `{ site, profile: { handle, name, published }, map: CareerMapView | null }`;
  `PUT /api/proof/site`; `POST /api/proof/site/draft`. Publishing uses the existing `POST /api/profile/publish`;
  add `POST /api/proof/site/unpublish` if no unpublish path exists.
- `/dashboard/proof/site`: editor (new title, previous role, tagline, bio, translations, contact email, LinkedIn,
  handle), "Draft it from my map", save, preview, publish. Inside `DashboardShell activeTab="proof"`.
- `/u/[handle]`: when a `ProofSite` exists render the new page per `Proof.dc.html` (rm look): hero, route strip +
  translations, "Things I built" (existing public artifacts from `getPublicProfileProof`), then
  `<ProfileVoiceModelSection>` and `<ProfileBuildLogSection>` (import both; E and F implement them), footer. When
  no `ProofSite` exists keep the current page unchanged (existing profiles and `alex-chen-ai` must not change).
- New example profile `maya-ortiz` (static, from `EXAMPLE_CAREER_MAP`, clearly labelled "Example profile"),
  rendered with the new layout including a static model comparison and three example build log titles.

### E. Voice model (`remap/e-model`)
Owns: `apps/web/lib/voice-model/*`, `apps/web/app/api/voice-models/**`, `apps/web/app/dashboard/proof/model/**`,
`apps/web/components/proof/profile-voice-model-section.tsx`, `apps/web/components/proof/voice-*`, tests `voice-model-*`.
- Store (real), `tune.ts` (samples -> `VoiceStyleProfile`), `run.ts` (`runVoiceComparison` -> base and tuned
  outputs in parallel; tuned = style profile + as many samples as fit a ~12k char budget; outputs capped ~220
  tokens; never quote samples verbatim; refuse off-purpose or harmful prompts with a short fixed sentence).
- Routes (billing-gated): `GET/POST /api/voice-models`, `GET/PATCH/DELETE /api/voice-models/[id]`,
  `POST /api/voice-models/[id]/samples` (one sample or many split on a line of `---`),
  `DELETE /api/voice-models/[id]/samples/[sampleId]`, `POST /api/voice-models/[id]/tune` (needs
  `VOICE_MODEL_MIN_SAMPLES`; saves style profile, base model, a demo comparison), `POST /api/voice-models/[id]/run`,
  `POST /api/voice-models/[id]/publish` body `{ published }`.
- Public: `POST /api/voice-models/public/[handle]/[slug]/run` body `{ prompt }` -> `{ ok, result }`. Only for
  published models on published profiles. Rate limit by hashed IP: 6/hour per IP, 80/day per model
  (count `voice_model_runs`). 429 `VOICE_MODEL_RATE_LIMITED`.
- `/dashboard/proof/model`: create (prefill name/sample type from the learner's map `proofPlan.model`), add and
  remove samples, tune, test, publish.
- `ProfileVoiceModelSection`: "Try my model" per the design: task input, "Run both", base vs tuned, model card
  (base model, method label, sample count and type, tuned date). Renders the saved demo before any run.

### F. Build log (`remap/f-buildlog`)
Owns: `apps/web/lib/build-log/*`, `apps/web/app/api/build-log/**`, `apps/web/app/dashboard/proof/log/**`,
`apps/web/app/u/[handle]/log/**`, `apps/web/app/api/og/log/**`,
`apps/web/components/proof/profile-build-log-section.tsx`, `apps/web/components/proof/build-log-*`, tests `build-log-*`.
- Store (real), `draft.ts` (`draftBuildLogPost({ notes, title?, context })`; must not add results the notes lack),
  `markdown.tsx` (safe minimal renderer to React elements: paragraphs, `##` headings, lists, bold/italic, inline
  code, fenced code, https links; no raw HTML, no `dangerouslySetInnerHTML`).
- Routes (billing-gated): `GET/POST /api/build-log`, `GET/PATCH/DELETE /api/build-log/[id]`,
  `POST /api/build-log/draft`, `POST /api/build-log/[id]/publish` body `{ published }`.
- `/dashboard/proof/log`: list, editor (title, summary, markdown body, live preview), "Draft from my notes",
  publish/unpublish, copy link, share to LinkedIn.
- Public `/u/[handle]/log/[slug]` (only when the profile is published and the post is published): article page in
  the rm look, BlogPosting JSON-LD, OG image route. `ProfileBuildLogSection`: list per the design.

### G. Remapped library (`remap/g-remapped`)
Owns: `apps/web/lib/remapped/*`, `apps/web/app/remapped/**`, `apps/web/app/sitemap.ts`, `apps/web/app/robots.ts`,
`apps/web/public/llms.txt`, `apps/web/public/agents.md`, `apps/web/public/.well-known/*`, tests `remapped-*`.
- Author 12 routes in `routes.ts`. Published now (publishAt on or before 2026-11-25): Marketing Manager ->
  `gtm-engineer` (slug `marketing-manager-to-go-to-market-engineer`), QA Tester -> `model-evaluator`
  (`qa-tester-to-model-evaluator`), Game Designer -> `ai-environment-designer`, Producer -> `ai-product-manager`,
  Concept Artist -> `ai-art-director`, Recruiter -> `ai-trainer`. Scheduled, one per Monday from 2026-11-30:
  Copywriter -> `ai-content-strategist`, Community Manager -> `ai-community-lead`, Support Lead ->
  `ai-support-ops-lead`, Brand Designer -> `generative-brand-designer`, Product Manager -> `ai-product-manager`
  is taken so use Product Manager -> `agent-ops-lead`, Paralegal -> `legal-ai-ops-specialist`.
  Each route: honest intro, 4 translations, 2-3 gaps, one first project with 4-6 concrete steps, 2-3 watch-outs.
  No statistics, no salary claims, no named real companies.
- `/remapped` index and `/remapped/[slug]` (RouteMap, TranslationList, gaps, first project, watch-outs, CTA to
  `/map`). Future-dated routes 404. `revalidate` daily. Article JSON-LD, metadata, sitemap entries for `/map`,
  `/remapped` and published routes; robots allows `/map` (not `/map/`) and `/remapped`.
- Update `llms.txt`, `agents.md` and `.well-known/*` to describe the new product, routes and CTA selectors.

### H. Funnel + dashboard (`remap/h-funnel`)
Owns: `apps/web/lib/funnel-events.ts`, `apps/web/lib/admin-analytics.ts`, `apps/web/lib/career-map-linking.ts`
(new), `apps/web/app/dashboard/_lib.ts`, `apps/web/app/dashboard/page.tsx`, `apps/web/app/dashboard/map/**`,
`apps/web/app/dashboard/proof/page.tsx`, `apps/web/app/api/onboarding/**`, `apps/web/app/sign-up/**`,
`apps/web/components/billing-gate-overlay.tsx`, `apps/web/components/dashboard/route-*` (new), `AGENTS.md`,
tests `funnel-*`, `career-map-linking-*`, `dashboard-map-*`.
- Register the funnel events (Set + union + admin tracked steps + tests).
- Linking: `linkCareerMapsForLearner({ learnerProfileId, email, cookieToken })` using the store's
  `linkCareerMapByToken` / `linkCareerMapsByEmail`; call it where anonymous assessments are linked
  (`dashboard/_lib.ts`, onboarding claim/complete). Read the cookie server-side with `next/headers`.
- `/dashboard/map`: the learner's map (RouteMap, translations, gaps, proof plan linking into Proof Studio); empty
  state links to `/map`.
- `/dashboard/proof`: hub with three cards (Site, Voice model, Build log) showing `getProofSiteStatus`,
  `getVoiceModelStatus`, `getBuildLogStatus`, links to `/dashboard/proof/site|model|log` (plain anchors), the
  public page link and publish state.
- Dashboard home: a "Your route" card (old title -> new title, next proof step). No map yet -> prompt to `/map`.
- Sign-up page: when `from=map`, the left panel says the map is saved and what Proof Studio builds next.
- Billing gate overlay: mention Proof Studio (site, voice model, build log) alongside what it lists today.
- Update `AGENTS.md` for the new product and routes.

## Integration (integrator only)
Merge A..H, wire nothing by hand that a seed did not already wire, grep for surviving `FOUNDATION-SEED` markers,
full typecheck + tests + `next build`, apply the migration to production, preview deploy, live walk, merge to main.
