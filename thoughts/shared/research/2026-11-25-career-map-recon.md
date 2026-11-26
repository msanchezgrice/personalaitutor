# Architecture brief: Career Map / Proof Studio recon (2026-11-25)

Repo: `/home/claude/personalaitutor` (pnpm 10 monorepo; Next 16.3.6, React 19.1, zod 3, Clerk 6, supabase-js 2, stripe 20). Line numbers are as of this checkout.

## 1. LLM client
- **`packages/shared/src/openai-responses.ts`**
  - `resolveOpenAiModel()`: L20, returns `process.env.OPENAI_MODEL ?? "gpt-4.1-mini"`.
  - `extractOpenAiOutputText(data)`: L24.
  - `callOpenAiResponses(input)`: L33.
  ```ts
  export async function callOpenAiResponses(input: {
    prompt: string; temperature?: number; model?: string;
    textFormat?: { type: string } & Record<string, unknown>; maxOutputTokens?: number;
  }): Promise<string>
  ```
  - Plain `fetch("https://api.openai.com/v1/responses")` with body `{model, input: prompt, temperature: ?? 0.2, text:{format}, max_output_tokens}`. No `AbortController`, so no timeout.
  - Throws `OPENAI_API_KEY_MISSING`, `OPENAI_RESPONSE_FAILED:${status}:${detail.slice(0,200)}`, or `OPENAI_EMPTY_RESPONSE`.
- **`apps/web/lib/openai-responses.ts`**: `import "server-only"` plus a re-export from `@aitutor/shared`. Web code imports from `@/lib/openai-responses`.
- **Canonical call site: `apps/web/lib/assessment-report.ts`**
  - zod `assessmentReportSchema` (L45-93) uses `z.preprocess` to round the score and `.refine` to restrict ids to the catalog.
  - `buildAssessmentReportPrompt(input)` (L129) builds a "STRICT JSON" prompt that spells out exact keys and grounding rules.
  - `parseAssessmentReport(raw)` (L226): strip ` ```json ` fences, then `JSON.parse` (on failure throws `ASSESSMENT_REPORT_INVALID_OUTPUT:NOT_JSON`), then `safeParse` (on failure throws `ASSESSMENT_REPORT_INVALID_OUTPUT:<first issue path>`).
  - `generateAssessmentReport(input): Promise<{report, model}>` (L243): calls the client with `{prompt, model, temperature:0.4, textFormat:{type:"json_object"}}` and maps `OPENAI_API_KEY_MISSING` to `OPENAI_CONFIG_MISSING` (L259-261).
- **Same pattern in shared:** `packages/shared/src/artifact-content.ts` `generateArtifactContent` (L310, `maxOutputTokens: 3000`) and `artifactGenerationFailureCode(error)` (L343), which maps errors to stable codes.
- **Route propagation: `app/api/assessment/anonymous/submit/route.ts` L83-108**
  ```ts
  try { generated = await generateAssessmentReport({...}); }
  catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    const code = reason.startsWith("OPENAI_CONFIG_MISSING") ? "OPENAI_CONFIG_MISSING" : "ASSESSMENT_REPORT_FAILED";
    return jsonError(code, "Unable to generate your report right now", 502, { reason: reason.slice(0,300), recoveryAction: "Retry the analysis in a minute" });
  }
  ```
- **Response helpers: `packages/shared/src/http.ts`** (also re-exported from `@/lib/runtime`)
  - `jsonOk(data)` returns `{ok:true, ...data}`.
  - `jsonError(code, message, status=400, details?)` returns `{ok:false, error:{code, message, ...details}}`.
  - Both set no-store cache headers.
  - Every route wraps its body in try/catch, returns `jsonError("<FEATURE>_FAILED", ..., 500, {reason})`, and validates bodies with zod (`INVALID_BODY`, 400, with `issues`).
- **`maxDuration`:** only set on `app/api/daily-action/route.ts` (`export const maxDuration = 120`) and the scheduler routes (300). The assessment submit route doesn't set it, although the UI says generation takes 15-30 s.

## 2. Persistence (dual mode)
- **The `mode()` block is duplicated** in every store: `lib/anonymous-assessment.ts` L59-71, `lib/artifact-content-store.ts` L28-40, `lib/daily-briefing-store.ts` L22-34, `lib/public-profile-proof.ts` L51-63, `lib/runtime.ts` L217-229.
  ```ts
  const explicit = process.env.PERSISTENCE_MODE?.toLowerCase();
  if (explicit === "supabase" || explicit === "memory") return explicit;
  if (explicit) throw new Error("PERSISTENCE_MODE_INVALID");
  if (SUPABASE_URL||NEXT_PUBLIC_SUPABASE_URL) && (SUPABASE_SERVICE_ROLE_KEY||SUPABASE_SERVICE_KEY) return "supabase";
  throw new Error("PERSISTENCE_MODE_REQUIRED");
  ```
- **Service-role client:** `apps/web/lib/supabase-admin.ts` `getSupabaseAdminClient()` (server-only, cached, `persistSession:false`, throws `SUPABASE_ENV_MISSING`). `runtime.ts` L240 has its own copy, `getSupabaseAdmin()`.
- **Structure of `anonymous-assessment.ts`:**
  - Domain types use camelCase; a `*Row` type uses snake_case.
  - Columns are listed in a `const *_SELECT_FIELDS` string, and a `fromRow()` mapper converts rows.
  - Table names are inline string literals: `.from("anonymous_assessments")`, `.from("assessment_report_history")`. Shared code exports constants instead (`PROJECT_ARTIFACT_CONTENTS_TABLE`).
  - Memory mode is `const memoryAssessments = new Map<string, AnonymousAssessment>()` (L94) plus `resetAnonymousAssessmentStateForTests()` (L97). Copies are returned with `{...record}`.
  - Errors are thrown as `ANONYMOUS_ASSESSMENT_CREATE_FAILED:${error.message}`; reads return `null` when not found.
  - `generateAssessmentSessionToken()` (L73) is `randomBytes(24).toString("base64url")`. `normalizeEmailAddress()` is L77.
  - Exports and lines: `createAnonymousAssessment` L190, `getAnonymousAssessmentById` L247, `findAnonymousAssessmentByToken` L265, `findLatestAnonymousAssessmentByEmail` L288, `submitAnonymousAssessment` L312, `captureAssessmentEmail` L383, `markAssessmentReportEmailSent` L426, `appendAssessmentReport` L451, `listAssessmentReports` L502, `getLatestAssessmentReport` L517, `getLatestAssessmentReportForProfile` L530, `listAssessmentReportsForProfile` L561, `linkAnonymousAssessmentsToProfile` L593.
- **Tests:** `vitest.config.ts` sets `env: { PERSISTENCE_MODE: "memory" }`, and tests call the `reset*ForTests()` functions in `beforeEach`.
- **Not dual mode:** `lib/funnel-events-server.ts` and `app/api/onboarding/resume-upload/route.ts` always use Supabase. Funnel writes swallow errors.

## 3. Migrations
- **Naming:** `supabase/migrations/YYYYMMDDHHMMSS_snake_description.sql`. The latest is `20260707210000_add_daily_briefings_actions_streaks.sql`.
- **Conventions:**
  - `create table if not exists public.x`, `id uuid primary key default gen_random_uuid()`, `created_at/updated_at timestamptz not null default now()`.
  - `check (...)` for enums; FKs to `public.learner_profiles(id) on delete set null|cascade`.
  - `create index if not exists ...`, partial indexes with `where ... is not null`.
  - `alter table ... enable row level security`, then `drop policy if exists`, then `create policy <table>_owner_select ... for select using (exists (select 1 from public.learner_profiles lp where lp.id = learner_profile_id and lp.auth_user_id = auth.uid()::text))`.
  - Global or service-only tables enable RLS with no policy (e.g. `daily_briefings`).
  - No GRANTs and no `updated_at` triggers anywhere; app code sets `updated_at` explicitly.
  - Header comments say "Additive only. Do not apply automatically — run via `supabase db push`."
- **Canonical example: `20260707150000_add_anonymous_assessments.sql`**
```sql
-- Anonymous assessment flow (Phase 1 rebuild): visitors take the assessment
-- without a Clerk account. Sessions are keyed by an unguessable token and
-- linked to a learner profile after sign-up (matched on captured email).

create table if not exists public.anonymous_assessments (
  id uuid primary key default gen_random_uuid(),
  session_token text not null unique,
  status text not null default 'started' check (status in ('started', 'submitted', 'completed')),
  career_path_id text,
  career_category_label text,
  job_title text,
  years_experience text,
  company_size text,
  situation text,
  goals jsonb not null default '[]'::jsonb,
  ai_comfort integer,
  linkedin_url text,
  resume_text text,
  answers jsonb not null default '[]'::jsonb,
  email text,
  email_captured_at timestamptz,
  report_email_sent_at timestamptz,
  learner_profile_id uuid references public.learner_profiles(id) on delete set null,
  linked_at timestamptz,
  visitor_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index if not exists anonymous_assessments_email_idx
  on public.anonymous_assessments (email)
  where email is not null;

create index if not exists anonymous_assessments_profile_idx
  on public.anonymous_assessments (learner_profile_id)
  where learner_profile_id is not null;

create index if not exists anonymous_assessments_created_idx
  on public.anonymous_assessments (created_at desc);

alter table public.anonymous_assessments enable row level security;

drop policy if exists anonymous_assessments_owner_select on public.anonymous_assessments;
create policy anonymous_assessments_owner_select on public.anonymous_assessments
  for select using (
    learner_profile_id is not null and exists (
      select 1
      from public.learner_profiles lp
      where lp.id = learner_profile_id
        and lp.auth_user_id = auth.uid()::text
    )
  );

-- Score history: every readiness-score computation appends a row.
-- The score trend is the product's spine (free tier = see it, paid = move it).
create table if not exists public.assessment_report_history (
  id uuid primary key default gen_random_uuid(),
  anonymous_assessment_id uuid references public.anonymous_assessments(id) on delete cascade,
  learner_profile_id uuid references public.learner_profiles(id) on delete set null,
  readiness_score integer not null check (readiness_score between 0 and 100),
  deterministic_score numeric,
  model text,
  report jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists assessment_report_history_assessment_idx
  on public.assessment_report_history (anonymous_assessment_id, created_at);

create index if not exists assessment_report_history_profile_idx
  on public.assessment_report_history (learner_profile_id, created_at desc)
  where learner_profile_id is not null;

alter table public.assessment_report_history enable row level security;

drop policy if exists assessment_report_history_owner_select on public.assessment_report_history;
create policy assessment_report_history_owner_select on public.assessment_report_history
  for select using (
    learner_profile_id is not null and exists (
      select 1
      from public.learner_profiles lp
      where lp.id = learner_profile_id
        and lp.auth_user_id = auth.uid()::text
    )
  );
```
- **`scripts/verify_migrations.sh`** only checks that the supabase CLI is installed, that `supabase/migrations/*.sql` exists, and that `supabase migration list` runs. It does not lint the SQL.

## 4. Anonymous assessment flow end to end
- **Page:** `app/assessment/page.tsx` is a server component.
  - It calls `getAuthSeed().catch(()=>null)` and passes `viewer` to `<AnonymousAssessment viewer/>`.
  - Signed-in users skip email capture.
  - `app/assessment/layout.tsx` mounts `<ForceDarkTheme/>`.
- **Client component:** `components/anonymous-assessment.tsx` (672 lines).
  - Steps: role, goals, quiz, generating, email.
  - Uses a local `postJson` wrapper to `/api/assessment/anonymous/{start,submit,email}`.
  - Funnel events: `anonymous_assessment_started`, `anonymous_assessment_completed`, `assessment_email_captured`, sent via `captureAnalyticsEvent` with `anonymous_assessment_id` (never `session_id:`, which a test enforces).
  - Résumé is a textarea (L480).
- **API routes:**
  - `start/route.ts`: body `{careerPathId?, visitorId?}` returns `{assessment:{id,status,createdAt}, sessionToken}`.
  - `submit/route.ts`:
    - Body is zod-validated: `sessionToken` 20-200 chars, `resumeText` up to 20,000, `answers` 1-12.
    - Flow: `findAnonymousAssessmentByToken` (404 `SESSION_NOT_FOUND`), then `submitAnonymousAssessment`, then `computeDeterministicAssessmentScore`, then `generateAssessmentReport` (502 on failure), then, if signed in, `captureAssessmentEmail` + `runtimeGetBillingAccessState` + `linkAnonymousAssessmentsToProfile`, then `appendAssessmentReport`.
    - Returns `{score, report, reportId, reportPath:"/assessment/report/<token>"}`.
  - `email/route.ts`: body `{sessionToken, email}`.
    - Flow: `captureAssessmentEmail`, then `getLatestAssessmentReport`, then a best-effort `sendAssessmentReportEmail` (failure only logs), then `markAssessmentReportEmailSent`.
    - Returns `{captured, emailed, reportPath}`.
- **Report page:** `app/assessment/report/[token]/page.tsx`.
  - `dynamic="force-dynamic"`, robots noindex.
  - Calls `findAnonymousAssessmentByToken(decodeURIComponent(token))`, `getLatestAssessmentReport`, `listAssessmentReports`; `notFound()` if missing.
  - Mounts `<AssessmentReportTracking>`, which sends `assessment_report_viewed`.
- **Email:** `lib/assessment-report-email.ts` `sendAssessmentReportEmail({to,name?,score,headline,reportUrl}): Promise<boolean>`.
  - Raw `fetch("https://api.resend.com/emails")`.
  - From address: `RESEND_FROM_EMAIL` env, falling back to `` `${BRAND_NAME} <onboarding@resend.dev>` ``.
  - Missing `RESEND_API_KEY` returns false.
  - Other Resend senders: `lib/campaign-email.ts`, which returns `{ok, errorCode:"RESEND_API_KEY_MISSING"|...}`, and `runtime.ts` L262-321 `sendWelcomeEmail`.
- **Linking to a signed-up user:** `linkAnonymousAssessmentsToProfile({learnerProfileId, email})` matches on normalized email, only claims unlinked rows, and also back-fills `assessment_report_history`. It is called from:
  - `app/dashboard/_lib.ts` L99-111, on every dashboard load inside `getDashboardBillingState`.
  - `app/api/onboarding/claim/route.ts` ~L45.
  - `app/api/onboarding/complete/route.ts` ~L143.
  - `lib/onboarding-readiness.ts` L134.
  - The submit route (signed-in retake).
  - Separately, `app/api/onboarding/assessment-context/route.ts` L24 and `onboarding-readiness.ts` L71 read via `findLatestAnonymousAssessmentByEmail`.
- **Rate limiting / abuse protection: none.** No ratelimit, upstash, turnstile, recaptcha or 429 handling anywhere. The only protection is the unguessable token. Every submit costs one OpenAI call.

## 5. Résumé handling
- **`app/api/onboarding/resume-upload/route.ts`**
  - multipart `formData` with `sessionId`, `sessionToken`, `file`.
  - Validates with `verifyOnboardingSessionToken` from `lib/onboarding-session-token.ts`.
  - Limit `MAX_BYTES = 10*1024*1024`. Extensions `pdf|doc|docx|txt`, plus a MIME allowlist.
  - Defines its own local `getSupabaseAdminClient()` (L22) instead of the shared one.
  - Creates the bucket if missing (`SUPABASE_RESUME_BUCKET` or `"onboarding-resumes"`, private) and uploads to `onboarding/<sessionId>/<ts>-<safeName>`.
  - Only stores `onboarding_sessions.resume_filename`.
  - **No text extraction.** There are no parsing libraries (no pdf-parse, mammoth or pdfjs) in `apps/web/package.json`, and no memory mode.
- **`app/api/onboarding/career-import/route.ts`:** JSON metadata only (`careerPathId`, `jobTitle`, `yearsExperience`, `linkedinUrl`, `resumeFilename`, ...), then `runtimeUpdateOnboardingCareerImport`.
- **Where résumé text actually lives:** only in the anonymous flow, as pasted text in `anonymous_assessments.resume_text`. The prompt uses `.slice(0, 6000)`.

## 6. Auth (Clerk)
- **`apps/web/proxy.ts`**
  - `isPublicRoute` list is at L4-46. It includes `/`, `/assessment(.*)`, `/learn(.*)`, `/u/(.*)`, `/api/assessment/anonymous/(.*)`, `/api/analytics/funnel(.*)`, `/api/og/(.*)`, `/api/scheduler/(.*)`, `/tools/career-remapping` (exact), `/downloads/career-remapping-workbook.pdf`, `/robots.txt`, `/sitemap.xml`, among others.
  - Non-public requests without a userId: `/api/*` returns 401 `{ok:false,error:{code:"UNAUTHENTICATED"}}`; pages redirect to `/sign-in?redirect_url=`.
  - Sets the `x-pathname` header always and `x-user-id` when signed in.
  - Matcher is at L89-93 (see Gotchas for the extension problem).
- **`apps/web/lib/auth.ts`**
  - `getAuthUserId(req?)` (L27): Clerk `auth()`, falling back to the `x-user-id` header.
  - `getAuthSeed(req?): Promise<{userId, name?, handleBase?, avatarUrl?, email?} | null>` (L37) uses `currentUser()` for the primary email.
  - `lib/api.ts` `getUserId(req)` reads the `x-user-id` header only.
- **Learner profile id:** this is the `learner_profiles.id` uuid, which is different from the Clerk id. Get it via `runtimeGetBillingAccessState({userId, seed})` (`runtime.ts` L1894; it calls `runtimeGetOrCreateProfile`) and read `.profile.id`, or via `requireBillingAccess(...).billing.profile`.
- **Admin:** `lib/admin-access.ts` `isAdminEmail(email)` against `ADMIN_EMAIL_ALLOWLIST` (comma-separated). If unset it falls back to a single hard-coded default email. Surfaced as `getDashboardServerState().isAdmin`; admin pages call `notFound()` when false.

## 7. Billing gate
- **`lib/billing.ts`:** `billingAccessAllowed(status)` is true only for `trialing|active`. Also `normalizeBillingStatus`, `shouldRedirectBlockedDashboardPath(pathname, status)` (blocks everything except `/dashboard`), `buildBillingGateRedirect(path)` (returns `/dashboard?billing=required&return_to=...`), and `buildCheckoutUrls`.
- **Server, API side:** `lib/billing-access.ts` `requireBillingAccess({userId, seed?, message?})` returns `{ok:true, billing}` or `{ok:false, billing, response}`, where `response` is a 402 `SUBSCRIPTION_REQUIRED` with `{billing:{status,accessAllowed}}`. `billingSeedFromAuthSeed(seed)` builds the seed. `runtimePublishProfile` also re-checks billing.
- **Server, pages:** `app/dashboard/layout.tsx` calls `getDashboardBillingGateState()` and redirects blocked non-admin paths.
- **Client side:** there is no client-side entitlement check. On `/dashboard` only, `<DashboardShell locked lockOverlay={<BillingGateOverlay .../>}>` blurs the content, and the overlay POSTs `/api/billing/checkout`, which returns `{url}`.
- **`lib/stripe-server.ts`:** `createStripeCheckoutSession`, `createStripePortalSession`, `syncBillingFromCheckoutSession`, `handleStripeWebhookEvent`, `getStripePriceId`.

## 8. Dashboard architecture
- **`app/dashboard/layout.tsx`:** force-dynamic, noindex, billing redirect, renders `<>{children}</>` with no shell.
- **Shell:** each page renders `<DashboardShell>` from `components/dashboard-runtime-shell.tsx`.
  - Props (L11-34): `activeTab`, `headerTitle`, `headerSubtitle`, `headerActions`, `runtimeBootstrap`, `initialUser`, `locked`, `lockOverlay`, `decor`, ...
  - Always loads `<Script src="/gemini-runtime.js">` (L310), plus `DashboardRouteHydrator` and `DashboardRoutePrefetcher`.
  - Markup is dark Tailwind classes (`bg-[#0f111a] text-white`) that `styles.css` repaints to light.
- **Pattern for a normal React page:** `app/dashboard/social/page.tsx`. Note that its `social-media-composer.tsx` is not imported anywhere (dead code).
  ```tsx
  const state = await getDashboardServerState();
  return <DashboardShell activeTab="..." headerTitle={...} runtimeBootstrap={buildDashboardRuntimeBootstrap(state)}
     initialUser={{ name, headline: resolveLearnerRoleLabel(...), avatarUrl, publicProfileUrl: state.publicProfileUrl, levelLabel: state.sidebarLevel.label, ... }}>
     ...your React...
  </DashboardShell>;
  ```
  - Admin pages (`app/dashboard/admin/analytics/page.tsx`) follow the same pattern and add `if(!state.isAdmin) notFound()`.
- **Adding a nav item:**
  1. Extend the `DashboardTab` union (L9) and the `DashboardHref` union (L36-42); `typedRoutes` is on.
  2. Add an entry to `navItems` (L53-96) with `key, href, label, icon (fa-*), activeClassName, iconClassName`.
  3. **Required:** add a `currentPath === "/dashboard/<new>"` branch in `public/gemini-runtime.js` `hydrateCurrentPath` (~L5330) that sets `document.documentElement.setAttribute("data-runtime-ready","1")`, copying the admin branch at ~L5382. Otherwise the fallback at ~L5392-5403 calls `window.location.replace("/dashboard/")`, and the first-paint hold from `theme-script.ts` L18-21 keeps the page invisible until then.
  4. Optionally add the path to `authRequiredPaths` (~L1472).
  - `tests/unit/dashboard-nav.test.ts` slices the `navItems` block: it must still contain "Chat Tutor", "AI News" and "Activity", and must not contain `/dashboard/social`.
  - `tests/unit/dashboard-unknown-path.test.ts` guards the fallback.
  - `components/dashboard-sidebar.tsx` is legacy and not imported anywhere.
- **Legacy static templates:** `components/gemini-static-page.tsx` `GeminiStaticPage({template, replacements?, className?, runtime?:"full"|"none"})` (L521).
  - Reads `mockups/high_fidelity/<template>` from disk (several fallback paths, L403-407; throws `GEMINI_TEMPLATE_NOT_FOUND`).
  - Takes the `<body>` contents, strips `<script>` tags, applies per-template rewrites (L28-377) and brand string replacements (L453), then renders with `dangerouslySetInnerHTML` inside `data-gemini-shell="1"`.
  - `runtime="full"` also loads `gemini-runtime.js` (5,605 lines of vanilla JS that hydrate dashboard pages through API calls and localStorage caches).
- **Theme:**
  - Root `<html data-theme="light">` (`app/layout.tsx` L209). `lib/theme-script.ts` forces light, sets `data-path`, and sets `data-style-ready="0"` on `/`, `/dashboard*`, `/u/*`, `/learn*`, `/employers*`, revealing once the `/styles.css` probe passes or after 2.2 s. On those paths `globals.css` L78-107 hides `[data-gemini-shell="1"]` and shows the `[data-shell-loader]` spinner until ready.
  - `styles.css` L638-720 contains the light-mode `!important` overrides; `.gemini-light-shell` starts at L1060.
  - `components/force-dark-theme.tsx` sets `data-theme="dark"` while mounted.
- **What a new standalone LIGHT page must do:**
  - Don't use `ForceDarkTheme`.
  - Wrap content in `<main className="gemini-light-shell ...">` (model: `app/tools/career-remapping/page.tsx`, `app/u/[handle]/page.tsx`) or use explicit `slate-*`/`bg-white` classes.
  - Avoid relying on `text-white` or dark `bg-*` utilities, because they get repainted.
  - Only add `data-gemini-shell="1"` if you accept the style-ready hold on the paths listed above.

## 9. Public profile
- **`app/u/[handle]/page.tsx`** (603 lines, `revalidate = 300`).
  - `resolveProfileView(handle)` uses `runtimeFindUserByHandle` (`runtime.ts` L1872, `learner_profiles` plus skills) and `runtimeListProjectsByUser`.
  - Unpublished profiles are visible only to their owner (via `getAuthSeed` and `runtimeFindUserById`).
  - The example handle `alex-chen-ai` comes from `app/u/public-profile-utils.ts` (`EXAMPLE_PROFILE_HANDLE`, `exampleProfile`, `exampleProjects`, `exampleProfileProof`, `safeHttpUrl`, `prettyProjectState`, `stateTone`, `skillTone`).
  - Metadata adds an OG image at `/api/og/profile/<handle>`. Emits Person JSON-LD. Root element is `<main data-gemini-shell="1" className="gemini-light-shell public-profile-shell ...">`.
- **`lib/public-profile-proof.ts`** (server-only). `getPublicProfileProof(profile, projects, now?)` (L423) returns `PublicProfileProof {readiness, plan, skills, artifacts, activity, streak, level}`. Each source is failure-isolated, and absent data hides its section. Sources:
  - `assessment_report_history`: readiness and delta.
  - `plan-progress.ts`: 30-day-plan progress.
  - `user_skill_evidence`: skills, re-gated through `verification-gating.ts`.
  - `project_artifacts`: only entries with generated content or submitted proof.
  - `module_tutor_sessions`: build activity.
  - `learner_streaks`: streak.
  - `buildDashboardGamification`: level.
  - Pure helpers: `derivePublicReadiness`, `gatePublicSkills`, `collectPublicArtifacts`, `assemblePublicProfileProof`.
- **API routes:**
  - `api/profile/route.ts` PATCH: zod (handle, name, avatarUrl, headline 4-140, bio 8-1200, tools, goals, socialLinks), then `runtimeUpdateProfile(userId, patch)`.
  - `api/profile/publish/route.ts` POST: `requireBillingAccess`, then `runtimePublishProfile` (`runtime.ts` L2207: sets `learner_profiles.published=true` and records a `profile.publish` job/event). Returns `{profile, publicUrl}`.
  - `api/profile/[handle]` GET: 404 `PROFILE_NOT_FOUND`, 403 `PROFILE_NOT_PUBLISHED`. It is **not** on the proxy public list, so signed-out callers get a 401.
- **OG images:** `api/og/profile/[handle]/route.ts` returns an SVG from `generateProfileOgSvg` (runtime.ts) for published profiles. `api/og/project/[handle]/[projectSlug]/route.ts` is the project equivalent.
- **Tables:** `learner_profiles` (`auth_user_id`, `handle` unique, `full_name`, `headline`, `bio`, `career_path_id`, `published`, ...), `projects`, `project_artifacts`, `user_skill_evidence`, `build_log_entries` (`project_id`, `learner_profile_id`, `message`, `level info|success|warn|error`, `metadata`; written by `runtime.ts` `appendBuildLog` L1040), `module_tutor_sessions`, `learner_streaks`.
- **Voice model:** nothing exists for this yet.

## 10. Landing page and the tests around it
- **How `/` renders:** `app/page.tsx` (`dynamic="force-dynamic"`).
  - `<GeminiStaticPage template="index.html" replacements={...} runtime="none"/>` with `mockups/high_fidelity/index.html`.
  - Injects the learn-guides and FAQ HTML at the `<!-- CTA -->` marker.
  - Signed-in users get the "Log In" button rewritten to `href="/dashboard/?welcome=1"`.
  - Also renders `<HomePageTracking/>` and Organization/WebSite/FAQPage JSON-LD.
- **CSS/JS:** the template's own `<head>` is discarded. Styling comes from the root layout: `/styles.css`, Font Awesome, and the Tailwind CDN. CTAs carry `data-testid` (`cta-start-assessment-nav`, `cta-take-assessment-hero`, `cta-see-profiles-hero`, `cta-start-trial-pricing`, `cta-start-assessment-bottom`) and `data-agent-action`.
- **`components/home-page-tracking.tsx`:** sends `landing_page_viewed` on mount and `landing_cta_clicked` on clicks of `a[href$='/assessment']`, `a[href$='/assessment/']` and the sign-up/onboarding links.
- **Tests on the home page and CTAs:**
  - `tests/unit/landing-page-copy.test.ts` (template file): hero "Build AI skills that actually fit your career.", exact `<title>`, "Career Builder", "$49.99", "7-day free trial", "Start 7-Day Free Trial", ">Features<", the four feature headings in order, no "System Verified Proof" or ">Public Proof<", screenshot `src`/`alt` pairs. On `page.tsx` source it checks the two metadata description strings.
  - `tests/unit/assessment-cta-routing.test.ts`: `page.tsx` has no `/sign-up?redirect_url=/onboarding/` and does contain `href="/dashboard/?welcome=1"`; `home-page-tracking.tsx` contains `a[href$='/assessment/']` and `"landing_cta_clicked"`; `gemini-static-page.tsx` doesn't rewrite assessment links; the template contains `href="/assessment`; plus assertions on the assessment files.
  - `tests/e2e/hard-gate.spec.ts`: link "Take the AI Assessment", the hero heading and four feature headings visible, "$49.99", "7-day free trial", `html[data-theme=light]`, `#theme-toggle` count 0, body never contains "cryptographic", "system verified proof" or "public proof".
  - `tests/e2e/landing-header.spec.ts`: first `header` sticks at top 0 after scroll, and `h1` sits below the header (desktop and mobile).
  - `tests/unit/google-tag.test.ts` and `tests/unit/ad-conversions-attribution.test.ts` also mention landing; they cover tag and attribution wiring.
- **Proxy routes:** `tests/unit/career-public-routes.test.ts` mocks `clerkMiddleware` as passthrough and asserts `/tools/career-remapping` and the PDF return 200 with no redirect, and that `/dashboard` redirects to `/sign-in`.
- **No tests** for `sitemap.ts`, `robots.ts`, `llms.txt` or `agents.md`.
  - `sitemap.ts` lists `/`, `/employers`, `/employers/talent`, `/learn`, `/tools/career-remapping`, the example profile, all learn slugs, and up to 200 real talent handles. `/assessment` is not included.
  - `robots.ts` allows `/`, `/employers`, `/employers/talent`, `/u/` and disallows `/dashboard`, `/onboarding`, `/sign-in`, `/sign-up`, `/api/`.

## 11. Analytics / funnel
- **`lib/funnel-events.ts`:** `CLIENT_PERSISTED_FUNNEL_EVENTS` Set (L5-23) and the `PersistedFunnelEventKey` union (L25-47).
- **Adding a new event:**
  1. Add the name to both the Set and the union.
  2. Add it to `TRACKED_STEP_KEYS` in `lib/admin-analytics.ts` (L100-118). `PRIMARY_FUNNEL_STEP_KEYS` (L89-98) drives the main funnel and the source/campaign/landing breakdowns.
  3. Optionally surface a count in the report summary, as done for `anonymousAssessmentStarted` at L395.
  4. Update `tests/unit/funnel-events.test.ts`.
  - The DB column `event_key` is plain text with no check constraint, so no migration is needed.
- **Client:** `lib/analytics.ts` `captureAnalyticsEvent(event, props)` (L231) sends to PostHog (`window.posthog`, initialised inline in the root layout when `NEXT_PUBLIC_POSTHOG_KEY` is set), forwards to GA, and, if the event is in the persisted set, `relayPersistedFunnelEvent` sends it via `sendBeacon` to `/api/analytics/funnel` (L183). Other exports: `getOrCreateFunnelVisitorId`, `identifyAnalyticsUser`, `createAnalyticsEventId`.
- **Server:** `app/api/analytics/funnel/route.ts` validates with zod, ignores events not in the persisted set (`{ignored:true}`), maps `properties.user_id`, `onboarding_session_id`/`session_id`, `project_id` and the UTM fields, then calls `recordPersistedFunnelEvent` (`lib/funnel-events-server.ts` L62), which inserts into `learner_funnel_events` and swallows errors.
- **Server-side PostHog:** `capturePosthogServerEvent` in `packages/shared/src/posthog.ts`, used by the worker.

## 12. CSP, verbatim from `apps/web/next.config.ts` L19-32
```
default-src 'self'
base-uri 'self'
frame-ancestors 'none'
object-src 'none'
form-action 'self'
script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://*.posthog.com https://connect.facebook.net https://snap.licdn.com https://static.ads-twitter.com https://va.vercel-scripts.com https://*.clerk.com https://*.clerk.accounts.dev https://clerk.myaiskilltutor.com https://challenges.cloudflare.com https://www.googletagmanager.com
worker-src 'self' blob:
style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com
img-src 'self' data: blob: https:
font-src 'self' data: https://cdnjs.cloudflare.com https://fonts.gstatic.com
connect-src 'self' https://api.openai.com https://api.resend.com https://api.linkedin.com https://www.linkedin.com https://api.twitter.com https://*.posthog.com https://www.facebook.com https://connect.facebook.net https://px.ads.linkedin.com https://analytics.twitter.com https://ads-twitter.com https://vitals.vercel-insights.com https://*.clerk.com https://clerk.myaiskilltutor.com https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://www.googletagmanager.com
frame-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://clerk.myaiskilltutor.com https://challenges.cloudflare.com https://share.synthesia.io https://app.synthesia.io https://td.doubleclick.net
```
- **No `media-src`**, so it falls back to `'self'`: self-hosted mp4 is fine, external video is not.
- **Google Fonts:** allowed.
- **Inline styles and scripts:** allowed.
- **The SelfImprove widget is blocked.** The layout loads it from `selfimprove-iota.vercel.app` (L288-292), which isn't in script-src.
- **Other headers:** `X-Frame-Options DENY`, `Permissions-Policy camera=(), microphone=(self), geolocation=()` (microphone is allowed, which matters for voice), HSTS.
- **Test:** `tests/unit/csp-config.test.ts` checks for required sources.

## 13. Fonts and styling for React pages
- **`app/layout.tsx`:**
  - `<link rel="stylesheet" href="/styles.css" id="app-shared-stylesheet">` (L233) plus Font Awesome 6.4.0 from cdnjs (L234).
  - `<Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive"/>` (L274/281).
  - Inline scripts: `attribution-capture`, `theme-boot`, PostHog, the FB, Google, LinkedIn and X pixels.
  - `ClerkProvider`, Vercel Analytics and SpeedInsights.
  - The first-paint loader markup.
- **No `next/font`.** Fonts come from `styles.css` L1: `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300..800&family=Outfit:wght@400..800&display=swap')`. Pages use `font-[Outfit]` arbitrary classes.
- **`app/globals.css`** (150 lines): reset, loader, style-hold rules, billing-gate colour fixes, `:focus-visible`.
- **Tailwind:** Play CDN only. No package, no config file, no pinned version; classes are generated at runtime.
- **CSS modules:** one example only, `app/chat-onboarding-prototype/chat-onboarding-prototype.module.css`.

## 14. Tests
- **`vitest.config.ts`**
  - Include pattern is `tests/**/*.test.ts`; `.tsx` files are not picked up.
  - Environment is node, globals on, `PERSISTENCE_MODE=memory`.
  - Aliases: `@`, `@aitutor/shared` (to src), `@aitutor/daily-content`, `server-only` (to `tests/support/server-only.ts`, which is `export {}`), plus react, react-dom, react-dom/server and `@clerk/nextjs/server` resolved from `apps/web/node_modules`.
- **Commands and counts:**
  - `pnpm test` runs `vitest run tests/unit`: 78 files, about 563 `test`/`it` calls.
  - `pnpm test:integration` runs `tests/integration/api.test.ts`: 3 tests against the `packages/shared/src/store` memory store.
  - `pnpm test:e2e` runs Playwright (`playwright.config.ts`: testDir `tests/e2e`, starts `PERSISTENCE_MODE=memory pnpm --filter @aitutor/web dev` on :6396). Files: `hard-gate.spec.ts` (5), `landing-header.spec.ts` (1, two viewports), `dashboard-authenticated.spec.ts` (3, via `playwright.auth.config.ts` and `dashboard-auth.setup.ts`/`clerk-auth.ts` with `@clerk/testing`).
  - `tests/live/*.live.test.ts` hit real OpenAI and are run manually.
  - `pnpm verify:all` chains everything.
  - `pnpm lint` also runs `scripts/verify_design_conformance.sh`, which fails on `hero.png`, "cryptographically verified", or `from-indigo-500|to-purple-600|text-indigo-|text-purple-` anywhere in `apps/web/{app,components,lib}`.
- **Route-handler test example: `tests/unit/assessment-authed-retake.test.ts`**
  - `vi.hoisted` mocks.
  - `vi.mock("next/server", () => ({ NextRequest: MockNextRequest }), {virtual:true})`, where `MockNextRequest extends Request` and adds `nextUrl`.
  - `vi.mock("@/lib/auth", () => ({ getAuthSeed: mockGetAuthSeed }))`.
  - `vi.mock("@/lib/assessment-report", ...)` to stub the LLM.
  - Real memory-mode stores, reset in `beforeEach`.
  - Imports `POST` from the route file and calls it with `new MockNextRequest(url, {method, body})`.
  - Renders client components with `renderToStaticMarkup` imported from `../../apps/web/node_modules/react-dom/server.node.js`.
- **OpenAI mocking:** `tests/unit/assessment-report.test.ts` uses `vi.stubEnv("OPENAI_API_KEY","test-key")` and `vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({output_text: JSON.stringify(payload)}),text:async()=>""}))`, with `vi.unstubAllEnvs/Globals` in before/after hooks.
- **Supabase:** never mocked in this suite; memory mode is used instead.
- **Clerk:** mocked via `@/lib/auth`, or via the `@clerk/nextjs/server` `clerkMiddleware` passthrough in the proxy test.
- **Many tests read source files as strings** (`readFileSync` plus `toContain`), so renaming strings or files can break them.

## 15. Worker
`apps/worker/src/index.ts` is a single file of about 2,400 lines, run with `tsx` and deployed on Render (`docs/render_worker_setup.md`, `scripts/render_worker_deploy.sh`).
- **Job loop:** polls `agent_jobs` through the `claim_agent_jobs` RPC and handles `project.chat`, `project.generate_website`/`project.generate_artifact` (real LLM content through shared `generateArtifactContent`) and `memory.refresh`.
- **Scheduler loop:** lifecycle emails, billing checkout reminders, daily signup report, sent through Resend.
- **Web crons:** daily news, daily update, weekly report and winback run as Vercel crons hitting `/api/scheduler/*` with `CRON_SECRET`.
- **Do new features need it?** Not for request/response LLM features like the Career Map; call the LLM from the route, as assessment submit does. Use it only for long async generation through `createJob` plus a new job type.

## 16. Shared package
- **No build step for web.** `packages/shared/package.json` has `main` and `types` pointing at `src/index.ts`; there is no `exports` map, and the only dependency is zod.
  - Resolution: `tsconfig.base.json` paths `@aitutor/shared` → `packages/shared/src/index.ts` and `@aitutor/shared/*` → `src/*`, plus the `workspace:*` dependency in `apps/web/package.json`, plus the vitest alias.
  - `pnpm -r build` runs `tsc` on shared, which only checks it.
- **Adding a module:**
  1. Create `packages/shared/src/<name>.ts` with extensionless relative imports.
  2. Add `export * from "./<name>"` to `src/index.ts`.
  3. Keep it free of Next or `server-only` imports, since the worker uses it too.
  4. Watch for export-name collisions, because `index.ts` re-exports everything flat.
- **LLM zod schemas:** `packages/shared/src/artifact-content.ts` (schemas L26-84, `buildArtifactContentPrompt` L267, `parseArtifactContent` L293, `generateArtifactContent` L310) and `briefing-rescore.ts`. Web-only schemas live in `apps/web/lib/assessment-report.ts`.

## 17. Existing career-remapping code and content
- **`app/tools/career-remapping/page.tsx`:** a public light page (`gemini-light-shell learning-shell`, `LearningHeader`/`LearningFooter`) rendering `<CareerTools/>`, with links to five guides. In the sitemap; exact-match public route.
- **`components/career-tools.tsx`** (client): five modes, `map|resume|reset|proof|gaming`.
- **`lib/career-tools.ts`:**
  - `careerDirections`: six editorial directions (quality, design, marketing, product, analytics, support), each with a regex pattern, gaps, project and check.
  - `mapExperience(text)`: regex matching on affirmed clauses, skipping negated ones. No LLM.
  - `buildResumeEvidence(input)` and `buildCareerPlan(directionId, hours, mode)`.
  - All browser-only; nothing persisted.
- **`lib/career-learn-content.ts`:** `careerLearnArticles: LearnArticle[]`, merged into `learn-content.ts` at L1177. Slugs, all in category "Career Proof":
  - `ai-skills-for-resume`
  - `my-job-is-disappearing`
  - `career-change-after-gaming-layoff`
  - `how-to-get-a-job-in-the-age-of-ai`
  - `career-mapping-transferable-skills`
  - `transferable-skills-examples`
  - `ai-portfolio-examples`
  - `career-remapping-workbook` (`resource.href` points to `/downloads/career-remapping-workbook.pdf`)
- **Tests:** `tests/unit/career-tools.test.ts`, `career-learning-content.test.ts`, `career-public-routes.test.ts`, `learn-article-rendering.test.ts`.
- **Career path catalog:** `CAREER_PATHS`/`getCareerPath` in `packages/shared/src/matrix.ts`, nine paths. The assessment uses these ids.

## Gotchas
1. **Dashboard runtime redirect.** A new `/dashboard/*` page must be registered in `gemini-runtime.js` `hydrateCurrentPath`, or it is redirected home and stays hidden by the `data-runtime-ready="0"` hold. Admin paths are exempt in both `theme-script.ts` and the runtime.
2. **Light theme overrides.** The `!important` rules repaint `.text-white`/`.text-gray-*`/dark `bg-*` on every light page. Dark pages need `<ForceDarkTheme/>`; light pages should use `gemini-light-shell` or slate colours. Several e2e tests assert `data-theme="light"` on `/`.
3. **Style hold.** On `/`, `/dashboard*`, `/u/*`, `/learn*` and `/employers*`, anything marked `data-gemini-shell="1"` stays hidden until `/styles.css` loads (or 2.2 s pass), and the shell loader overlays the page.
4. **Proxy matcher extensions.** It does not skip `.txt`, `.md`, `.json`, `.pdf` or `.mp4`, so videos, PDFs, `llms.txt`, `agents.md` and `.well-known` files need public-route entries (several appear unreachable when signed out right now). New public pages and anonymous APIs (e.g. `/career-map(.*)`, `/api/career-map/(.*)`) must be added to `isPublicRoute`. `/api/profile/[handle]` currently requires auth.
5. **Tailwind via CDN** means no build-time purging, no config, possible flash of unstyled content, and no `@apply`. `next/font` would work under the CSP but is unused. Fonts are Google Fonts via `styles.css`.
6. **`server-only`:** web lib modules that touch secrets start with `import "server-only"` (aliased to an empty module in vitest). `packages/shared` must not import it.
7. **Don't grow `lib/runtime.ts`.** This rule comes from `thoughts/shared/plans/2026-07-07-myaiskilltutor-rebuild.md` L32/L105 and the continuity ledger. Use new modules, and extract anything you touch.
8. **Hard-failure LLM contract.** No fallback or placeholder content. Map key-missing to `OPENAI_CONFIG_MISSING` and return 502 with `{reason, recoveryAction}`. Consider `export const maxDuration`, since there is no fetch timeout.
9. **No abuse protection exists.** Anonymous LLM endpoints are open; a new anonymous résumé endpoint should add its own limit, for example per `visitorId`/IP plus a size cap.
10. **No résumé parser exists.** PDF/DOCX → text needs a new dependency or a "paste text" input, as in the anonymous flow.
11. **`typedRoutes: true`.** `Link`/`redirect` targets must be real routes or cast `as Route`; new hrefs must be added to unions like `DashboardHref`.
12. **Test conventions.** Only `*.test.ts` files run (no `.tsx`). Many tests string-match source files, so changing landing copy, CTA hrefs or `hard-gate` phrases breaks them. The landing body must never contain "public proof" or "cryptographic", which matters for "Proof Studio" copy on `/`. The design-conformance lint bans indigo/purple Tailwind classes and `hero.png`.
13. **Migrations** are additive and applied manually (`supabase db push`). Enable RLS on every table, add an owner-select policy via `learner_profiles.auth_user_id = auth.uid()::text`, set `updated_at` in app code, add no GRANTs, and keep the timestamp prefix ordered after `20260707210000`.
14. **Two identities.** The Clerk user id (`seed.userId`, `x-user-id`) is not the learner profile uuid (`billing.profile.id`). Tables reference `learner_profiles(id)`, and `getProfileRowById` accepts either.
15. **The landing template is production.** `mockups/high_fidelity/index.html` is read at runtime by `GeminiStaticPage`, and the `mockups/` directory must ship with the deploy. Replacing `/` with React means updating `app/page.tsx` and the tests in section 10, plus `HomePageTracking`'s CTA selectors, and keeping the `data-testid`/`data-agent-action` attributes that AGENTS.md promises to agents.
16. **Email is best-effort** (returns false without `RESEND_API_KEY`); report generation is not.
17. **Funnel inserts** need Supabase and silently no-op in memory mode, so tests never see them.
18. **Dead or legacy files** to ignore: `components/dashboard-sidebar.tsx` and `app/dashboard/social/social-media-composer.tsx` are not imported anywhere.

## Notes for memory
Nothing new from user memory was needed for this task. Repo-sourced facts the main session may want to keep:
- The "don't grow runtime.ts" rule comes from `thoughts/shared/plans/2026-07-07-myaiskilltutor-rebuild.md` (repo file, not memory).
- The default admin email is hard-coded in `apps/web/lib/admin-access.ts` (repo file).
