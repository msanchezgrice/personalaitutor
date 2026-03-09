import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-runtime-shell";
import { getDashboardServerState } from "@/app/dashboard/_lib";
import { runtimeListSignupAuditRecords, type SignupAuditRecord } from "@/lib/runtime";
import { getCatalogData } from "@aitutor/shared";
import {
  assessmentAnswerEntries,
  formatDateTime,
  isMetaSource,
  resolveMetaCampaignNames,
  resolvePosthogPersonUrls,
  safeExternalUrl,
  stringArray,
  stringValue,
  stringifyJson,
} from "./view-helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function clampNumber(input: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function displaySource(record: SignupAuditRecord) {
  const last = record.onboarding?.acquisition?.last ?? record.profile.acquisition?.last;
  const first = record.onboarding?.acquisition?.first ?? record.profile.acquisition?.first;
  return {
    source: last?.utmSource || first?.utmSource || "unknown",
    medium: last?.utmMedium || first?.utmMedium || "unknown",
    campaign: last?.utmCampaign || first?.utmCampaign || "unknown",
    content: last?.utmContent || first?.utmContent || "unknown",
    term: last?.utmTerm || first?.utmTerm || "unknown",
    landingPath: last?.landingPath || first?.landingPath || "unknown",
    referrer: last?.referrer || first?.referrer || "unknown",
  };
}

export default async function DashboardAdminSignupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const state = await getDashboardServerState();

  if (!state.seed?.userId) {
    redirect("/sign-in" as Route);
  }
  if (!state.isAdmin) {
    notFound();
  }

  const days = clampNumber(readParam(params.days), 7, 1, 90);
  const limit = clampNumber(readParam(params.limit), 50, 1, 200);
  const q = readParam(params.q).trim();
  const catalog = getCatalogData();
  const careerPathNames = new Map(catalog.careerPaths.map((entry) => [entry.id, entry.name]));
  const records = await runtimeListSignupAuditRecords({
    days,
    limit,
    search: q || undefined,
  });
  const attributions = records.map((record) => displaySource(record));
  const [directPosthogUrls, metaCampaignNames] = await Promise.all([
    resolvePosthogPersonUrls(records.map((record) => record.posthogDistinctId)),
    resolveMetaCampaignNames(
      attributions
        .filter((attribution) => isMetaSource(attribution.source))
        .map((attribution) => attribution.campaign),
    ),
  ]);

  const startedOnboarding = records.filter((record) => Boolean(record.onboarding)).length;
  const completedAssessment = records.filter((record) => Boolean(record.assessment?.submittedAt)).length;
  const chatted = records.filter((record) => record.chat.userMessageCount > 0).length;
  const welcomeSent = records.filter((record) => Boolean(record.welcomeEmailSentAt)).length;
  const sourceCounts = new Map<string, number>();
  for (const record of records) {
    const source = displaySource(record).source.toLowerCase();
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }
  const sourceBreakdown = Array.from(sourceCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return (
    <DashboardShell
      activeTab="activity"
      headerTitle={(
        <span className="flex items-center gap-3">
          <i className="fa-solid fa-chart-line text-emerald-400"></i> Signup Audit
        </span>
      )}
      headerSubtitle="Protected operator view for real signups, persisted onboarding answers, assessments, and chat activity."
      operatorToolsHref={state.operatorToolsUrl}
      initialUser={{
        name: state.user?.name ?? state.seed?.name ?? "Operator",
        headline: state.user?.headline ?? "Operator",
        avatarUrl: state.user?.avatarUrl ?? state.seed?.avatarUrl ?? null,
        publicProfileUrl: state.publicProfileUrl,
        levelLabel: "Operator",
        levelSubtitle: "Growth + support console",
        levelProgressPct: 100,
        levelProgressText: "Access granted",
      }}
      headerActions={(
        <a
          href="https://us.posthog.com/project/330799/dashboard"
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary text-xs px-4 py-2"
        >
          <i className="fa-solid fa-arrow-up-right-from-square mr-2"></i>Open PostHog
        </a>
      )}
      hideHeaderActionsOnMobile
      decor={<div className="absolute top-0 right-1/4 w-[420px] h-[260px] bg-emerald-500/10 blur-[120px] pointer-events-none"></div>}
    >
      <div className="p-10 max-w-7xl mx-auto w-full pb-24 space-y-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="glass rounded-2xl border border-emerald-500/20 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-emerald-400">Real signups</div>
            <div className="mt-3 text-4xl font-[Outfit] text-white">{records.length}</div>
            <div className="mt-2 text-sm text-gray-400">Last {days} day{days === 1 ? "" : "s"}</div>
          </div>
          <div className="glass rounded-2xl border border-sky-500/20 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-sky-400">Onboarding started</div>
            <div className="mt-3 text-4xl font-[Outfit] text-white">{startedOnboarding}</div>
            <div className="mt-2 text-sm text-gray-400">{records.length ? Math.round((startedOnboarding / records.length) * 100) : 0}% of signups</div>
          </div>
          <div className="glass rounded-2xl border border-amber-500/20 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-amber-400">Assessment complete</div>
            <div className="mt-3 text-4xl font-[Outfit] text-white">{completedAssessment}</div>
            <div className="mt-2 text-sm text-gray-400">{records.length ? Math.round((completedAssessment / records.length) * 100) : 0}% of signups</div>
          </div>
          <div className="glass rounded-2xl border border-violet-500/20 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-violet-300">Sent a chat</div>
            <div className="mt-3 text-4xl font-[Outfit] text-white">{chatted}</div>
            <div className="mt-2 text-sm text-gray-400">{welcomeSent} welcome email{welcomeSent === 1 ? "" : "s"} sent</div>
          </div>
        </section>

        <section className="glass rounded-2xl p-6 md:p-8">
          <form className="grid items-end gap-4 lg:grid-cols-[1.4fr,repeat(2,minmax(0,0.55fr)),auto]" method="get">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Search</span>
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Name, email, or handle"
                className="w-full rounded-full border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Window</span>
              <select
                name="days"
                defaultValue={String(days)}
                className="w-full rounded-full border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="2">Last 48 hours</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Limit</span>
              <select
                name="limit"
                defaultValue={String(limit)}
                className="w-full rounded-full border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </label>
            <div className="flex gap-3">
              <button type="submit" className="btn btn-primary px-6 py-3">Apply</button>
              <Link href="/dashboard/admin/signups" className="btn btn-secondary px-6 py-3">Clear</Link>
            </div>
          </form>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            {sourceBreakdown.length ? sourceBreakdown.map(([source, count]) => (
              <span key={source} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-gray-300">
                {source}: {count}
              </span>
            )) : (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-gray-400">No signups in this window</span>
            )}
          </div>
        </section>

        <section className="space-y-4">
          {records.length ? records.map((record, index) => {
            const attribution = displaySource(record);
            const directPosthogUrl = (record.posthogDistinctId && directPosthogUrls.get(record.posthogDistinctId)) || record.posthogPersonUrl;
            const metaCampaignName = isMetaSource(attribution.source) ? metaCampaignNames.get(attribution.campaign) ?? null : null;
            const intakeProfile = record.onboarding?.intakeProfile ?? null;
            const intake = intakeProfile && typeof intakeProfile === "object" ? intakeProfile as Record<string, unknown> : {};
            const recommendedPaths = (record.assessment?.recommendedCareerPathIds ?? [])
              .map((entry) => careerPathNames.get(entry) ?? entry)
              .join(", ");
            const linkedInUrl = safeExternalUrl(stringValue(intake.linkedinUrl) || record.onboarding?.linkedinUrl || record.profile.socialLinks.linkedin || null);
            const goalList = stringArray(intake.selectedGoals);
            const rawFullName = stringValue(intake.fullName);
            const rawJobTitle = stringValue(intake.jobTitle);
            const rawCareerCategory = stringValue(intake.careerCategoryLabel) || stringValue(intake.careerCategory) || stringValue(intake.customCareerCategory);
            const assessmentEntries = assessmentAnswerEntries(record.assessment?.answers);

            return (
              <details
                key={record.profile.id}
                className="glass rounded-2xl border border-white/10 p-6"
                open={index === 0 && !q}
              >
                <summary className="list-none cursor-pointer">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-[Outfit] text-white">{record.profile.name || "Unnamed signup"}</h2>
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                          {attribution.source}
                        </span>
                        {record.onboarding ? (
                          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-300">
                            onboarding: {record.onboarding.status}
                          </span>
                        ) : null}
                        {record.assessment?.submittedAt ? (
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                            assessment complete
                          </span>
                        ) : null}
                        {record.chat.userMessageCount ? (
                          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-300">
                            {record.chat.userMessageCount} chat message{record.chat.userMessageCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-400">
                        <span>{record.profile.contactEmail || "No contact email"}</span>
                        <span>@{record.profile.handle}</span>
                        <span>Joined {formatDateTime(record.profile.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-300">
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                        campaign: {metaCampaignName ? `${metaCampaignName} (${attribution.campaign})` : attribution.campaign}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">content: {attribution.content}</span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">term: {attribution.term}</span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">projects: {record.projectCount}</span>
                    </div>
                  </div>
                </summary>

                <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
                  <section className="space-y-6">
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                      <div className="mb-4 flex flex-wrap gap-2">
                        <a
                          href={`/dashboard/admin/signups/${record.profile.id}`}
                          className="btn btn-primary px-4 py-2 text-xs"
                        >
                          <i className="fa-solid fa-clock-rotate-left mr-2"></i>Full timeline
                        </a>
                        {directPosthogUrl ? (
                          <a
                            href={directPosthogUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary px-4 py-2 text-xs"
                          >
                            <i className="fa-solid fa-arrow-up-right-from-square mr-2"></i>Open in PostHog
                          </a>
                        ) : null}
                        {linkedInUrl ? (
                          <a
                            href={linkedInUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary px-4 py-2 text-xs"
                          >
                            <i className="fa-brands fa-linkedin mr-2"></i>LinkedIn
                          </a>
                        ) : null}
                        {record.resume.signedUrl ? (
                          <a
                            href={record.resume.signedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary px-4 py-2 text-xs"
                          >
                            <i className="fa-solid fa-file-arrow-down mr-2"></i>Open resume
                          </a>
                        ) : null}
                      </div>
                      <dl className="grid gap-3 text-sm md:grid-cols-2">
                        <div>
                          <dt className="text-gray-500">PostHog distinct id</dt>
                          <dd className="break-all text-white">{record.posthogDistinctId || "Not available"}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Resume file</dt>
                          <dd className="break-all text-white">{record.resume.fileName || "No uploaded resume"}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">LinkedIn URL</dt>
                          <dd className="break-all text-white">
                            {linkedInUrl ? <a href={linkedInUrl} target="_blank" rel="noreferrer" className="text-sky-300 underline underline-offset-2">{linkedInUrl}</a> : "Not provided"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">External auth id</dt>
                          <dd className="break-all text-white">{record.externalUserId || "Not available"}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Profile</div>
                      <dl className="grid gap-3 text-sm md:grid-cols-2">
                        <div>
                          <dt className="text-gray-500">Headline</dt>
                          <dd className="text-white">{record.profile.headline || "Not set"}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Career path</dt>
                          <dd className="text-white">{careerPathNames.get(record.profile.careerPathId) ?? record.profile.careerPathId}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Goals</dt>
                          <dd className="text-white">{record.profile.goals.length ? record.profile.goals.join(", ") : "Not set"}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Welcome email</dt>
                          <dd className="text-white">{record.welcomeEmailSentAt ? formatDateTime(record.welcomeEmailSentAt) : "Not sent"}</dd>
                        </div>
                      </dl>
                      <div className="mt-4">
                        <div className="text-gray-500">Bio (synthesized)</div>
                        <div className="mt-1 whitespace-pre-wrap text-sm text-gray-300">{record.profile.bio || "Not set"}</div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">Raw Onboarding Inputs</div>
                      <dl className="grid gap-3 text-sm md:grid-cols-2">
                        <div>
                          <dt className="text-gray-500">Entered full name</dt>
                          <dd className="text-white">{rawFullName || "Not set"}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Entered job title</dt>
                          <dd className="text-white">{rawJobTitle || "Not set"}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Situation</dt>
                          <dd className="text-white">{record.onboarding?.situation || String(intake.situation || "Not set")}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Primary goal</dt>
                          <dd className="text-white">
                            {goalList.length
                              ? goalList[0]
                              : record.onboarding?.goals?.[0] || "Not set"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Career category</dt>
                          <dd className="text-white">{rawCareerCategory || "Not set"}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Years experience</dt>
                          <dd className="text-white">{String(intake.yearsExperience || "Not set")}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Company size</dt>
                          <dd className="text-white">{String(intake.companySize || "Not set")}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">AI comfort</dt>
                          <dd className="text-white">{String(intake.aiComfort || "Not set")}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">LinkedIn</dt>
                          <dd className="text-white break-all">
                            {linkedInUrl ? <a href={linkedInUrl} target="_blank" rel="noreferrer" className="text-sky-300 underline underline-offset-2">{linkedInUrl}</a> : "Not set"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Resume file</dt>
                          <dd className="text-white">
                            {record.resume.signedUrl ? (
                              <a href={record.resume.signedUrl} target="_blank" rel="noreferrer" className="text-sky-300 underline underline-offset-2">
                                {record.resume.fileName}
                              </a>
                            ) : (
                              record.resume.fileName || "Not set"
                            )}
                          </dd>
                        </div>
                        <div className="md:col-span-2">
                          <dt className="text-gray-500">All selected goals</dt>
                          <dd className="text-white">{goalList.length ? goalList.join(", ") : (record.onboarding?.goals.length ? record.onboarding.goals.join(", ") : "Not set")}</dd>
                        </div>
                      </dl>
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Assessment</div>
                      <dl className="grid gap-3 text-sm md:grid-cols-2">
                        <div>
                          <dt className="text-gray-500">Score</dt>
                          <dd className="text-white">
                            {record.assessment ? `${Math.round((record.assessment.score <= 1 ? record.assessment.score * 100 : record.assessment.score) || 0)}%` : "Not started"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Submitted</dt>
                          <dd className="text-white">{record.assessment?.submittedAt ? formatDateTime(record.assessment.submittedAt) : "Not submitted"}</dd>
                        </div>
                        <div className="md:col-span-2">
                          <dt className="text-gray-500">Recommended paths</dt>
                          <dd className="text-white">{recommendedPaths || "Not available"}</dd>
                        </div>
                      </dl>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {assessmentEntries.length ? assessmentEntries.map((entry) => (
                          <span key={entry.questionId} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300">
                            {entry.question}: {entry.answer}
                          </span>
                        )) : (
                          <span className="text-sm text-gray-400">No assessment answers yet.</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Chat Activity</div>
                      <dl className="grid gap-3 text-sm md:grid-cols-2">
                        <div>
                          <dt className="text-gray-500">User messages</dt>
                          <dd className="text-white">{record.chat.userMessageCount}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Last message at</dt>
                          <dd className="text-white">{record.chat.lastUserMessageAt ? formatDateTime(record.chat.lastUserMessageAt) : "No chat yet"}</dd>
                        </div>
                      </dl>
                      <div className="mt-4">
                        <div className="text-gray-500">Last user message</div>
                        <div className="mt-1 whitespace-pre-wrap text-sm text-gray-300">{record.chat.lastUserMessage || "No chat message stored yet."}</div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                      <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-gray-300">Attribution + raw payloads</div>
                      <dl className="grid gap-3 text-sm md:grid-cols-2">
                        <div>
                          <dt className="text-gray-500">UTM source / medium</dt>
                          <dd className="text-white">{attribution.source} / {attribution.medium}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Campaign</dt>
                          <dd className="text-white break-words">
                            {metaCampaignName ? `${metaCampaignName} (${attribution.campaign})` : attribution.campaign}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Content / creative id</dt>
                          <dd className="text-white break-all">{attribution.content}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Term / ad id</dt>
                          <dd className="text-white break-all">{attribution.term}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Landing path</dt>
                          <dd className="text-white break-all">{attribution.landingPath}</dd>
                        </div>
                        <div className="md:col-span-2">
                          <dt className="text-gray-500">Referrer</dt>
                          <dd className="text-white break-all">{attribution.referrer}</dd>
                        </div>
                      </dl>
                      <div className="mt-4 grid gap-4 xl:grid-cols-2">
                        <div>
                          <div className="mb-2 text-gray-500">Assessment answers</div>
                          <div className="rounded-xl border border-white/10 bg-[#0b0d13] p-4 text-sm text-slate-100">
                            {assessmentAnswerEntries(record.assessment?.answers).length ? (
                              <dl className="space-y-3">
                                {assessmentAnswerEntries(record.assessment?.answers).map((entry) => (
                                  <div key={entry.questionId}>
                                    <dt className="text-xs uppercase tracking-[0.14em] text-slate-400">{entry.question}</dt>
                                    <dd className="mt-1 text-slate-100">{entry.answer} <span className="text-slate-400">({entry.scoreLabel})</span></dd>
                                  </div>
                                ))}
                              </dl>
                            ) : (
                              <div className="text-slate-400">No assessment answers saved.</div>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="mb-2 text-gray-500">Acquisition JSON</div>
                          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-[#0b0d13] p-4 text-xs text-slate-100" style={{ color: "#e2e8f0" }}>
                            {stringifyJson(record.onboarding?.acquisition ?? record.profile.acquisition) || "No acquisition payload saved."}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </details>
            );
          }) : (
            <section className="glass rounded-2xl p-10 text-center text-gray-400">
              <h2 className="mb-3 text-2xl font-[Outfit] text-white">No signups matched this view</h2>
              <p className="mb-6">Try a wider date window or clear the search filter.</p>
              <Link href="/dashboard/admin/signups" className="btn btn-primary px-6 py-3">Reset view</Link>
            </section>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
