import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-runtime-shell";
import { buildDashboardRuntimeBootstrap, getDashboardServerState } from "@/app/dashboard/_lib";
import { runtimeGetSignupAuditDetail } from "@/lib/runtime";
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
} from "../view-helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function displaySource(detail: Awaited<ReturnType<typeof runtimeGetSignupAuditDetail>>) {
  if (!detail) {
    return {
      source: "unknown",
      medium: "unknown",
      campaign: "unknown",
      content: "unknown",
      term: "unknown",
      landingPath: "unknown",
      referrer: "unknown",
    };
  }
  const last = detail.onboarding?.acquisition?.last ?? detail.profile.acquisition?.last;
  const first = detail.onboarding?.acquisition?.first ?? detail.profile.acquisition?.first;
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

function timelineTone(category: string) {
  switch (category) {
    case "signup":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "attribution":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";
    case "onboarding":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
    case "assessment":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "project":
      return "border-violet-500/30 bg-violet-500/10 text-violet-300";
    case "chat":
      return "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300";
    case "email":
      return "border-lime-500/30 bg-lime-500/10 text-lime-300";
    default:
      return "border-white/10 bg-white/5 text-gray-300";
  }
}

export default async function DashboardAdminSignupDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const state = await getDashboardServerState();

  if (!state.seed?.userId) {
    redirect("/sign-in" as Route);
  }
  if (!state.isAdmin) {
    notFound();
  }

  const detail = await runtimeGetSignupAuditDetail(userId);
  if (!detail) {
    notFound();
  }

  const catalog = getCatalogData();
  const careerPathNames = new Map(catalog.careerPaths.map((entry) => [entry.id, entry.name]));
  const intake = detail.onboarding?.intakeProfile && typeof detail.onboarding.intakeProfile === "object"
    ? detail.onboarding.intakeProfile as Record<string, unknown>
    : {};
  const linkedInUrl = safeExternalUrl(stringValue(intake.linkedinUrl) || detail.onboarding?.linkedinUrl || detail.profile.socialLinks.linkedin || null);
  const goalList = stringArray(intake.selectedGoals);
  const rawCareerCategory = stringValue(intake.careerCategoryLabel) || stringValue(intake.careerCategory) || stringValue(intake.customCareerCategory);
  const recommendedPaths = (detail.assessment?.recommendedCareerPathIds ?? [])
    .map((entry) => careerPathNames.get(entry) ?? entry)
    .join(", ");
  const attribution = displaySource(detail);
  const [directPosthogUrls, metaCampaignNames] = await Promise.all([
    resolvePosthogPersonUrls([detail.posthogDistinctId]),
    resolveMetaCampaignNames(isMetaSource(attribution.source) ? [attribution.campaign] : []),
  ]);
  const directPosthogUrl = (detail.posthogDistinctId && directPosthogUrls.get(detail.posthogDistinctId)) || detail.posthogPersonUrl;
  const metaCampaignName = isMetaSource(attribution.source) ? metaCampaignNames.get(attribution.campaign) ?? null : null;

  return (
    <DashboardShell
      activeTab="activity"
      headerTitle={(
        <span className="flex items-center gap-3">
          <i className="fa-solid fa-user-clock text-emerald-400"></i> Signup Timeline
        </span>
      )}
      headerSubtitle={`${detail.profile.name} • ${detail.profile.contactEmail || detail.profile.handle}`}
      operatorToolsHref={state.operatorToolsUrl}
      billingPortalEnabled={Boolean(state.billing.subscription)}
      runtimeBootstrap={buildDashboardRuntimeBootstrap(state)}
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
        <div className="flex gap-2">
          <Link href="/dashboard/admin/signups" className="btn btn-secondary px-4 py-2 text-xs">
            <i className="fa-solid fa-arrow-left mr-2"></i>Back to list
          </Link>
          {directPosthogUrl ? (
            <a href={directPosthogUrl} target="_blank" rel="noreferrer" className="btn btn-secondary px-4 py-2 text-xs">
              <i className="fa-solid fa-arrow-up-right-from-square mr-2"></i>PostHog
            </a>
          ) : null}
        </div>
      )}
      hideHeaderActionsOnMobile
      decor={<div className="absolute top-0 right-1/4 w-[420px] h-[260px] bg-emerald-500/10 blur-[120px] pointer-events-none"></div>}
    >
      <div className="p-10 max-w-7xl mx-auto w-full pb-24 space-y-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="glass rounded-2xl border border-white/10 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Joined</div>
            <div className="mt-3 text-lg font-medium text-white">{formatDateTime(detail.profile.createdAt)}</div>
          </div>
          <div className="glass rounded-2xl border border-white/10 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Onboarding</div>
            <div className="mt-3 text-lg font-medium text-white">{detail.onboarding?.status || "Not started"}</div>
          </div>
          <div className="glass rounded-2xl border border-white/10 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Assessment</div>
            <div className="mt-3 text-lg font-medium text-white">
              {detail.assessment?.submittedAt ? `${Math.round((detail.assessment.score <= 1 ? detail.assessment.score * 100 : detail.assessment.score) || 0)}%` : "Not submitted"}
            </div>
          </div>
          <div className="glass rounded-2xl border border-white/10 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Chats / Projects</div>
            <div className="mt-3 text-lg font-medium text-white">{detail.chat.userMessageCount} / {detail.projectCount}</div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
          <div className="space-y-6">
            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Identifiers</div>
              <div className="mb-4 flex flex-wrap gap-2">
                {directPosthogUrl ? (
                  <a href={directPosthogUrl} target="_blank" rel="noreferrer" className="btn btn-secondary px-4 py-2 text-xs">
                    <i className="fa-solid fa-arrow-up-right-from-square mr-2"></i>Open in PostHog
                  </a>
                ) : null}
                {linkedInUrl ? (
                  <a href={linkedInUrl} target="_blank" rel="noreferrer" className="btn btn-secondary px-4 py-2 text-xs">
                    <i className="fa-brands fa-linkedin mr-2"></i>LinkedIn
                  </a>
                ) : null}
                {detail.resume.signedUrl ? (
                  <a href={detail.resume.signedUrl} target="_blank" rel="noreferrer" className="btn btn-secondary px-4 py-2 text-xs">
                    <i className="fa-solid fa-file-arrow-down mr-2"></i>Open resume
                  </a>
                ) : null}
              </div>
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-gray-500">Full name</dt>
                  <dd className="text-white">{detail.profile.name}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Email</dt>
                  <dd className="break-all text-white">{detail.profile.contactEmail || "Not available"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Handle</dt>
                  <dd className="text-white">@{detail.profile.handle}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">External auth id</dt>
                  <dd className="break-all text-white">{detail.externalUserId || "Not available"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">PostHog distinct id</dt>
                  <dd className="break-all text-white">{detail.posthogDistinctId || "Not available"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Career path</dt>
                  <dd className="text-white">{careerPathNames.get(detail.profile.careerPathId) ?? detail.profile.careerPathId}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">LinkedIn</dt>
                  <dd className="break-all text-white">
                    {linkedInUrl ? <a href={linkedInUrl} target="_blank" rel="noreferrer" className="text-sky-300 underline underline-offset-2">{linkedInUrl}</a> : "Not provided"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Resume</dt>
                  <dd className="break-all text-white">
                    {detail.resume.signedUrl ? <a href={detail.resume.signedUrl} target="_blank" rel="noreferrer" className="text-sky-300 underline underline-offset-2">{detail.resume.fileName}</a> : (detail.resume.fileName || "No uploaded resume")}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">Raw Inputs</div>
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-gray-500">Entered full name</dt>
                  <dd className="text-white">{stringValue(intake.fullName) || "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Entered job title</dt>
                  <dd className="text-white">{stringValue(intake.jobTitle) || "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Situation</dt>
                  <dd className="text-white">{detail.onboarding?.situation || stringValue(intake.situation) || "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Years experience</dt>
                  <dd className="text-white">{stringValue(intake.yearsExperience) || "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Company size</dt>
                  <dd className="text-white">{stringValue(intake.companySize) || "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">AI comfort</dt>
                  <dd className="text-white">{stringValue(intake.aiComfort) || "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Career category</dt>
                  <dd className="text-white">{rawCareerCategory || "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Primary goal</dt>
                  <dd className="text-white">{goalList[0] || detail.onboarding?.goals?.[0] || "Not set"}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-gray-500">All selected goals</dt>
                  <dd className="text-white">{goalList.length ? goalList.join(", ") : (detail.onboarding?.goals.length ? detail.onboarding.goals.join(", ") : "Not set")}</dd>
                </div>
              </dl>
            </div>

            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-gray-300">Synthesized Profile Output</div>
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-gray-500">Headline</dt>
                  <dd className="text-white">{detail.profile.headline || "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Welcome email</dt>
                  <dd className="text-white">{detail.welcomeEmailSentAt ? formatDateTime(detail.welcomeEmailSentAt) : "Not sent"}</dd>
                </div>
              </dl>
              <div className="mt-4">
                <div className="text-gray-500">Bio (synthesized)</div>
                <div className="mt-1 whitespace-pre-wrap rounded-xl border border-white/10 bg-[#0b0d13] p-4 text-sm text-slate-100">{detail.profile.bio || "Not set"}</div>
              </div>
            </div>

            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Assessment</div>
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-gray-500">Submitted</dt>
                  <dd className="text-white">{detail.assessment?.submittedAt ? formatDateTime(detail.assessment.submittedAt) : "Not submitted"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Recommended paths</dt>
                  <dd className="text-white">{recommendedPaths || "Not available"}</dd>
                </div>
              </dl>
              <div className="mt-4 rounded-xl border border-white/10 bg-[#0b0d13] p-4 text-sm text-slate-100">
                {assessmentAnswerEntries(detail.assessment?.answers).length ? (
                  <dl className="space-y-3">
                    {assessmentAnswerEntries(detail.assessment?.answers).map((entry) => (
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
          </div>

          <div className="space-y-6">
            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-white">Attribution</div>
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-gray-500">UTM source / medium</dt>
                  <dd className="text-white">{attribution.source} / {attribution.medium}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Campaign</dt>
                  <dd className="break-words text-white">
                    {metaCampaignName ? `${metaCampaignName} (${attribution.campaign})` : attribution.campaign}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Content / creative id</dt>
                  <dd className="break-all text-white">{attribution.content}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Term / ad id</dt>
                  <dd className="break-all text-white">{attribution.term}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Landing path</dt>
                  <dd className="break-all text-white">{attribution.landingPath}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Referrer</dt>
                  <dd className="break-all text-white">{attribution.referrer}</dd>
                </div>
              </dl>
            </div>

            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Projects</div>
              {detail.projects.length ? (
                <div className="space-y-3">
                  {detail.projects.map((project) => (
                    <div key={project.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-white">{project.title}</div>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-gray-300">{project.state}</span>
                      </div>
                      <div className="mt-2 text-sm text-gray-400">
                        Created {formatDateTime(project.createdAt)} • Updated {formatDateTime(project.updatedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-400">No projects yet.</div>
              )}
            </div>

            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-300">Chat Activity</div>
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-gray-500">User messages</dt>
                  <dd className="text-white">{detail.chat.userMessageCount}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Last message at</dt>
                  <dd className="text-white">{detail.chat.lastUserMessageAt ? formatDateTime(detail.chat.lastUserMessageAt) : "No chat yet"}</dd>
                </div>
              </dl>
              <div className="mt-4">
                <div className="text-gray-500">Last user message</div>
                <div className="mt-1 whitespace-pre-wrap rounded-xl border border-white/10 bg-[#0b0d13] p-4 text-sm text-slate-100">{detail.chat.lastUserMessage || "No chat message stored yet."}</div>
              </div>
            </div>

            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-white">Timeline</div>
              <ol className="space-y-4">
                {detail.timeline.length ? detail.timeline.map((entry) => (
                  <li key={entry.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${timelineTone(entry.category)}`}>
                            {entry.category}
                          </span>
                          <div className="font-medium text-white">{entry.title}</div>
                        </div>
                        {entry.detail ? <div className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-300">{entry.detail}</div> : null}
                      </div>
                      <div className="shrink-0 text-xs text-gray-500">{formatDateTime(entry.timestamp)}</div>
                    </div>
                  </li>
                )) : (
                  <li className="text-sm text-gray-400">No timeline entries found.</li>
                )}
              </ol>
            </div>

            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-gray-300">Raw Payloads</div>
              <div className="grid gap-4">
                <div>
                  <div className="mb-2 text-gray-500">Assessment answers</div>
                  <div className="rounded-xl border border-white/10 bg-[#0b0d13] p-4 text-sm text-slate-100">
                    {assessmentAnswerEntries(detail.assessment?.answers).length ? (
                      <dl className="space-y-3">
                        {assessmentAnswerEntries(detail.assessment?.answers).map((entry) => (
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
                    {stringifyJson(detail.onboarding?.acquisition ?? detail.profile.acquisition) || "No acquisition payload saved."}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
