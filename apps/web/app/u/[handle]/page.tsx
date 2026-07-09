import React from "react";
import Link from "next/link";
import { resolveLearnerRoleLabel } from "@aitutor/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthSeed } from "@/lib/auth";
import { runtimeFindUserByHandle, runtimeFindUserById, runtimeListProjectsByUser } from "@/lib/runtime";
import {
  getPublicProfileProof,
  isPublicArtifact,
  type PublicProfileProof,
} from "@/lib/public-profile-proof";
import {
  BRAND_NAME,
  BRAND_X_HANDLE,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
  getSiteUrl,
} from "@/lib/site";
import {
  EXAMPLE_PROFILE_HANDLE,
  exampleProfile,
  exampleProfileProof,
  exampleProjects,
  prettyProjectState,
  safeHttpUrl,
  skillTone,
  stateTone,
} from "@/app/u/public-profile-utils";

export const revalidate = 300;

async function resolveProfileView(handle: string) {
  const profile = await runtimeFindUserByHandle(handle);
  if (handle === EXAMPLE_PROFILE_HANDLE && (!profile || !profile.published)) {
    return {
      profile: exampleProfile(),
      projects: exampleProjects(),
      canView: true,
      isExample: true,
    };
  }

  let canView = false;
  if (profile && !profile.published) {
    const seed = await getAuthSeed();
    if (seed?.userId) {
      const viewerProfile = await runtimeFindUserById(seed.userId);
      canView = Boolean(viewerProfile && viewerProfile.id === profile.id);
    }
  }

  if (!profile || (!profile.published && !canView)) {
    return { profile: null, projects: [], canView: false, isExample: false };
  }

  return {
    profile,
    projects: await runtimeListProjectsByUser(profile.id),
    canView: true,
    isExample: false,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const view = await resolveProfileView(handle);
  const profile = view.profile;
  if (!profile) {
    return {
      title: "Profile not found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return {
    title: `${profile.name} | ${BRAND_NAME} Profile`,
    description: profile.bio,
    alternates: { canonical: `/u/${profile.handle}` },
    openGraph: {
      title: `${profile.name} | ${BRAND_NAME} Profile`,
      description: profile.bio,
      url: `/u/${profile.handle}`,
      type: "profile",
      images: [
        {
          url: DEFAULT_OG_IMAGE_PATH,
          width: DEFAULT_OG_IMAGE_WIDTH,
          height: DEFAULT_OG_IMAGE_HEIGHT,
          alt: DEFAULT_OG_IMAGE_ALT,
          type: "image/png",
        },
        {
          url: `/api/og/profile/${profile.handle}`,
          width: DEFAULT_OG_IMAGE_WIDTH,
          height: DEFAULT_OG_IMAGE_HEIGHT,
          alt: `${profile.name} profile preview`,
          type: "image/svg+xml",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: BRAND_X_HANDLE,
      creator: BRAND_X_HANDLE,
      title: `${profile.name} | ${BRAND_NAME} Profile`,
      description: profile.bio,
      images: [DEFAULT_OG_IMAGE_PATH],
    },
    robots: profile.published ? undefined : { index: false, follow: false },
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function readinessDeltaText(readiness: NonNullable<PublicProfileProof["readiness"]>) {
  if (readiness.delta === null) return "First assessment on record";
  if (readiness.delta > 0) return `+${readiness.delta} since first assessment`;
  if (readiness.delta < 0) return `${readiness.delta} since first assessment`;
  return "Holding steady since first assessment";
}

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const view = await resolveProfileView(handle);
  const profile = view.profile;
  if (!profile || !view.canView) {
    notFound();
  }

  const projects = view.projects;
  // Every proof number is assembled from real tables (or, for the labeled
  // example profile, through the same gated assembly) — nothing on this page
  // is fabricated at render time.
  const proof: PublicProfileProof = view.isExample
    ? exampleProfileProof()
    : await getPublicProfileProof(profile, projects);

  const avatarUrl = safeHttpUrl(profile.avatarUrl ?? undefined) || profile.avatarUrl || "/assets/avatar.png";
  const linkedInUrl = safeHttpUrl(profile.socialLinks.linkedin);
  const websiteUrl = safeHttpUrl(profile.socialLinks.website);
  const githubUrl = safeHttpUrl(profile.socialLinks.github);
  const xUrl = safeHttpUrl(profile.socialLinks.x);
  const isWarmupPreview = !profile.published
    && projects.length <= 1
    && projects.every((project) => project.slug === "starter-build" && project.state === "planned" && !project.artifacts.length && !project.buildLog.length)
    && profile.skills.every((entry) => entry.status === "in_progress" || entry.status === "not_started");
  const projectCount = isWarmupPreview ? 0 : projects.length;
  const verifiedCount = isWarmupPreview ? 0 : proof.skills.filter((entry) => entry.status === "verified").length;
  const proofCount = isWarmupPreview ? 0 : proof.artifacts.length;
  const readiness = isWarmupPreview ? null : proof.readiness;
  const plan = isWarmupPreview ? null : proof.plan;
  const showMomentum = !isWarmupPreview && Boolean(proof.level || proof.streak || proof.activity);
  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    description: profile.headline,
    url: `${getSiteUrl()}/u/${profile.handle}`,
    sameAs: [linkedInUrl, websiteUrl, githubUrl, xUrl].filter(Boolean),
    knowsAbout: proof.skills.map((entry) => entry.skill),
  };

  const previewLabel = view.isExample
    ? "Example profile"
    : profile.published
      ? "Public proof profile"
      : "Private owner preview";

  return (
    <>
      <main data-gemini-shell="1" className="gemini-light-shell public-profile-shell relative min-h-screen flex flex-col pt-20">
        <div className="bg-glow top-[-200px] left-[-120px] opacity-45"></div>
        <div
          className="bg-glow top-[18%] right-[-220px] opacity-35"
          style={{ background: "radial-gradient(circle, var(--secondary-glow) 0%, rgba(0,0,0,0) 70%)" }}
        ></div>

        <header className="glass fixed top-0 z-50 w-full rounded-none border-x-0 border-t-0 bg-opacity-80 backdrop-blur-xl">
          <div className="container nav py-4">
            <Link href="/" className="flex items-center gap-3">
              <img src="/assets/branding/brand_brain_icon.svg" alt={BRAND_NAME} className="h-11 w-11 object-contain" />
              <span className="font-[Outfit] text-[1.85rem] font-bold leading-none tracking-tight text-slate-900">
                {BRAND_NAME}
              </span>
            </Link>
            <div className="flex gap-4">
              <Link href="/dashboard/profile" className="btn btn-primary py-2 px-4 shadow-[0_4px_14px_0_var(--primary-glow)]">
                Dashboard
              </Link>
            </div>
          </div>
        </header>

        <div className="container max-w-6xl flex-grow py-12">
          <section className="glass-panel relative mb-12 overflow-hidden p-8 md:p-12">
            <div className="pointer-events-none absolute right-0 top-0 translate-x-12 -translate-y-12 p-8 opacity-5">
              <i className="fa-solid fa-certificate text-[250px] text-white"></i>
            </div>

            <div className="relative z-10 grid gap-8 xl:grid-cols-[1.2fr,0.8fr] xl:items-start">
              <div className="flex flex-col gap-8 md:flex-row md:items-start">
                <div className="relative shrink-0">
                  <img src={avatarUrl} alt={profile.name} className="relative z-10 h-32 w-32 rounded-full border-4 border-white/20 object-cover shadow-[0_0_30px_rgba(79,70,229,0.25)]" />
                  <div className="absolute -bottom-2 -right-2 z-20 rounded-full bg-black/40 p-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/50 bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.35)]">
                      <i className="fa-solid fa-check text-sm font-bold"></i>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-5 inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-400">
                    {previewLabel}
                  </div>
                  <h1 className="mb-2 text-4xl font-[Outfit] text-white md:text-5xl">{profile.name}</h1>
                  <p className="mb-5 text-lg font-medium text-emerald-400">{resolveLearnerRoleLabel({ headline: profile.headline, careerPathId: profile.careerPathId })}</p>
                  <p className="max-w-2xl border-l-2 border-white/10 py-1 pl-4 text-sm leading-relaxed text-gray-300 md:text-base">
                    {isWarmupPreview
                      ? "Your public proof site is connected, but the portfolio is still warming up. Ship the first real milestone or artifact from the dashboard and these sections will swap from starter scaffolding into verified public proof."
                      : profile.bio}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    {linkedInUrl ? (
                      <a href={linkedInUrl} target="_blank" rel="noreferrer" className="btn bg-[#0077b5] px-5 py-3 shadow-[0_10px_30px_rgba(10,119,181,0.22)]">
                        LinkedIn
                      </a>
                    ) : null}
                    {websiteUrl ? (
                      <a href={websiteUrl} target="_blank" rel="noreferrer" className="btn btn-secondary px-5 py-3">
                        Website
                      </a>
                    ) : null}
                    {githubUrl ? (
                      <a href={githubUrl} target="_blank" rel="noreferrer" className="btn btn-secondary px-5 py-3">
                        GitHub
                      </a>
                    ) : null}
                    {xUrl ? (
                      <a href={xUrl} target="_blank" rel="noreferrer" className="btn btn-secondary px-5 py-3">
                        X / Twitter
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                {readiness ? (
                  <div className="glass p-6 rounded-2xl border border-emerald-500/20 bg-black/30">
                    <p className="mb-2 text-sm text-gray-400">AI-readiness score</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-[Outfit] text-white">{readiness.score}</span>
                      <span className="text-sm text-gray-500">/ 100</span>
                    </div>
                    <p className={`mt-1 text-xs ${readiness.delta && readiness.delta > 0 ? "text-emerald-400" : "text-gray-400"}`}>
                      {readinessDeltaText(readiness)}
                    </p>
                  </div>
                ) : (
                  <div className="glass p-6 rounded-2xl border border-white/10 bg-black/30">
                    <p className="mb-2 text-sm text-gray-400">{isWarmupPreview ? "Published projects" : "Projects"}</p>
                    <div className="text-4xl font-[Outfit] text-white">{projectCount}</div>
                  </div>
                )}
                <div className="glass p-6 rounded-2xl border border-white/10 bg-black/30">
                  <p className="mb-2 text-sm text-gray-400">Verified skills</p>
                  <div className="text-4xl font-[Outfit] text-white">{verifiedCount}</div>
                </div>
                <div className="glass p-6 rounded-2xl border border-white/10 bg-black/30">
                  <p className="mb-2 text-sm text-gray-400">{isWarmupPreview ? "Proof artifacts shipped" : "Proof artifacts"}</p>
                  <div className="text-4xl font-[Outfit] text-white">{proofCount}</div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-8">
              {plan ? (
                <section className="glass rounded-2xl p-6">
                  <h2 className="mb-6 flex items-center gap-2 border-b border-white/10 pb-3 text-lg font-[Outfit] text-white">
                    <i className="fa-solid fa-route text-emerald-400"></i>
                    30-Day Plan
                  </h2>
                  <div className="mb-4 flex items-baseline justify-between">
                    <span className="text-2xl font-[Outfit] text-white">
                      Week {plan.currentWeek} <span className="text-base text-gray-500">of {plan.totalWeeks}</span>
                    </span>
                  </div>
                  <div className="mb-4 flex gap-2">
                    {plan.weeks.map((week) => (
                      <div
                        key={week.week}
                        title={`Week ${week.week}`}
                        className={`h-1.5 flex-1 rounded-full ${
                          week.completed
                            ? "bg-emerald-500"
                            : week.isCurrent
                              ? "bg-gradient-to-r from-emerald-500 to-cyan-400"
                              : "bg-white/10"
                        }`}
                      ></div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">This week&apos;s focus</div>
                    <p className="text-sm leading-6 text-white">{plan.focus}</p>
                    {plan.moduleTitle ? (
                      <p className="mt-2 text-xs text-gray-400">
                        <i className="fa-solid fa-graduation-cap mr-1 text-emerald-400"></i>
                        Module: {plan.moduleTitle}
                      </p>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <section className="glass rounded-2xl p-6">
                <h2 className="mb-6 flex items-center gap-2 border-b border-white/10 pb-3 text-lg font-[Outfit] text-white">
                  <i className="fa-solid fa-layer-group text-teal-400"></i>
                  {isWarmupPreview ? "Proof status" : "Verified Skill Stack"}
                </h2>
                <div className="space-y-6">
                  {isWarmupPreview ? (
                    <>
                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-500">
                          <i className="fa-solid fa-wand-magic-sparkles"></i>
                          Public proof is still warming up
                        </div>
                        <p className="text-sm leading-7 text-gray-400">
                          This profile is connected, but it has not shipped enough real work yet to populate verified proof cards.
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                          <div className="mb-1 text-sm font-medium text-white">First shipped milestone</div>
                          <p className="text-xs leading-6 text-gray-400">Complete the first real project step from the dashboard to replace the starter scaffolding.</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                          <div className="mb-1 text-sm font-medium text-white">Artifact generation</div>
                          <p className="text-xs leading-6 text-gray-400">Once build logs or artifacts exist, verified skill and project proof sections will populate automatically.</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Verified and built skills</div>
                        {proof.skills.length ? (
                          <div className="flex flex-wrap gap-2">
                            {proof.skills.map((entry) => (
                              <div key={entry.skill} className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
                                <i className={`fa-solid ${entry.status === "verified" ? "fa-award" : "fa-check-double"} text-xs text-emerald-400`}></i>
                                <span className="text-sm font-medium text-white">{entry.skill}</span>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${skillTone(entry.status)}`}>
                                  {entry.status === "verified" ? "Verified" : "Built"}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                  {entry.evidenceCount} proof{entry.evidenceCount === 1 ? "" : "s"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm leading-6 text-gray-400">
                            No verified skills yet. Skills appear here only after tutor-session proof and real
                            generated artifacts back them — nothing on this page is self-reported.
                          </p>
                        )}
                      </div>

                      <div>
                        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Tools and systems</div>
                        <div className="flex flex-wrap gap-2">
                          {profile.tools.length ? profile.tools.map((tool) => (
                            <span key={tool} className="rounded bg-white/5 px-2.5 py-1 text-xs text-gray-300 border border-white/10">{tool}</span>
                          )) : <span className="text-sm text-gray-400">No tools listed yet.</span>}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/5 bg-black/30 p-4 text-center">
                        <i className="fa-solid fa-shield-halved mb-2 text-2xl text-gray-500"></i>
                        <p className="text-xs text-gray-400">
                          Verified requires a completed tutor session plus a real generated artifact or submitted
                          proof. Built requires the artifact or proof. Unverified claims never render here.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </section>

              {showMomentum ? (
                <section className="glass rounded-2xl p-6">
                  <h2 className="mb-6 flex items-center gap-2 border-b border-white/10 pb-3 text-lg font-[Outfit] text-white">
                    <i className="fa-solid fa-bolt text-amber-400"></i>
                    Momentum
                  </h2>
                  <div className="space-y-3 text-sm text-gray-300">
                    {proof.level ? (
                      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4">
                        <div>
                          <div className="text-sm font-medium text-white">{proof.level.label}</div>
                          <div className="text-xs text-gray-400">{proof.level.subtitle}</div>
                        </div>
                        <div className="text-right text-xs text-gray-400">{proof.level.xpTotal.toLocaleString("en-US")} XP</div>
                      </div>
                    ) : null}
                    {proof.streak ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Current streak</div>
                          <div className="text-2xl font-[Outfit] text-white">
                            {proof.streak.current}
                            <span className="ml-1 text-xs text-gray-400">day{proof.streak.current === 1 ? "" : "s"}</span>
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Longest streak</div>
                          <div className="text-2xl font-[Outfit] text-white">
                            {proof.streak.longest}
                            <span className="ml-1 text-xs text-gray-400">day{proof.streak.longest === 1 ? "" : "s"}</span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {proof.activity ? (
                      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Tutor-session build activity</div>
                        <p className="text-sm text-white">
                          {proof.activity.sessionsCompleted} tutor session{proof.activity.sessionsCompleted === 1 ? "" : "s"} completed
                        </p>
                        {proof.activity.completedModules.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {proof.activity.completedModules.map((moduleTitle) => (
                              <span key={moduleTitle} className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-gray-300">
                                {moduleTitle}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <section className="glass rounded-2xl p-6">
                <h2 className="mb-6 flex items-center gap-2 border-b border-white/10 pb-3 text-lg font-[Outfit] text-white">
                  <i className="fa-solid fa-satellite-dish text-cyan-400"></i>
                  Tooling and signals
                </h2>
                <div className="space-y-4 text-sm text-gray-300">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Public URL</div>
                    <div className="break-all">{`${getSiteUrl()}/u/${profile.handle}`}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Profile handle</div>
                    <div>@{profile.handle}</div>
                  </div>
                  {!profile.published ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-400">
                      This is an owner preview. Publish from the dashboard when you are ready to expose the profile publicly.
                    </div>
                  ) : null}
                </div>
              </section>
            </div>

            <div className="space-y-8 lg:col-span-2">
              {!isWarmupPreview && proof.artifacts.length ? (
                <section className="space-y-4">
                  <h2 className="flex items-center gap-3 text-2xl font-[Outfit] text-white">
                    <i className="fa-solid fa-file-shield text-emerald-400"></i>
                    Proof Artifacts
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {proof.artifacts.map((artifact, index) => (
                      <a
                        key={`${artifact.url}-${index}`}
                        href={artifact.url}
                        target="_blank"
                        rel="noreferrer"
                        className="glass block rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-emerald-500/40 hover:bg-white/10"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                            {artifact.source === "generated" ? "Generated artifact" : "Submitted proof"}
                          </span>
                          {formatDate(artifact.createdAt) ? (
                            <span className="text-xs text-gray-500">{formatDate(artifact.createdAt)}</span>
                          ) : null}
                        </div>
                        <div className="mb-1 text-base font-medium text-white">{artifact.label}</div>
                        <p className="text-xs text-gray-400">
                          {artifact.projectTitle}
                          <i className="fa-solid fa-arrow-up-right-from-square ml-2 text-[10px] text-gray-500"></i>
                        </p>
                      </a>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    Every artifact above opens the real output. Artifacts without stored generated content never
                    appear on this page.
                  </p>
                </section>
              ) : null}

              <section className="space-y-8">
                <h2 className="flex items-center gap-3 text-2xl font-[Outfit] text-white">
                  <i className="fa-solid fa-folder-tree text-amber-400"></i>
                  {isWarmupPreview ? "Project pipeline" : "Project Portfolio"}
                </h2>

                {projects.length ? (
                  projects.map((project) => {
                    const projectProofCount = project.artifacts.filter(isPublicArtifact).length;
                    return (
                      <a
                        key={project.id}
                        href={`/u/${profile.handle}/projects/${project.slug}/`}
                        className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 transition hover:bg-white/10 hover:border-emerald-500/40 glass"
                      >
                        <div className="pointer-events-none absolute right-0 top-0 h-full w-64 bg-gradient-to-l from-emerald-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
                        <div className="flex flex-col gap-6 sm:flex-row">
                          <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/50 sm:w-48">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 to-teal-900/40 opacity-80 transition duration-500 group-hover:scale-105"></div>
                            <div className="relative flex h-full w-full items-center justify-center">
                              <i className={`fa-solid ${project.state === "building" ? "fa-headset" : project.state === "built" || project.state === "showcased" ? "fa-spider" : "fa-diagram-project"} text-3xl ${project.state === "building" ? "text-amber-400" : "text-emerald-400"}`}></i>
                            </div>
                          </div>

                          <div className="flex flex-1 flex-col justify-center">
                            <div className="mb-2 flex items-start justify-between gap-4">
                              <h3 className="text-xl font-medium text-white transition group-hover:text-emerald-400">{project.title}</h3>
                              <span className={`hidden whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider sm:block ${stateTone(project.state)}`}>
                                {prettyProjectState(project.state)}
                              </span>
                            </div>
                            <p className="mb-4 line-clamp-3 text-sm text-gray-400">
                              {isWarmupPreview
                                ? "Starter build detected. Public proof cards activate after the first real milestone, artifact, or shipped workflow is recorded."
                                : project.description}
                            </p>
                            <div className="flex flex-wrap gap-2 text-[10px]">
                              <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-gray-400">{projectProofCount} proof artifact{projectProofCount === 1 ? "" : "s"}</span>
                              <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-gray-400">{project.buildLog.length} build log entr{project.buildLog.length === 1 ? "y" : "ies"}</span>
                            </div>
                          </div>
                        </div>
                      </a>
                    );
                  })
                ) : (
                  <div className="glass rounded-2xl p-6 text-gray-400">
                    No public projects are attached to this profile yet.
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }} />
    </>
  );
}
