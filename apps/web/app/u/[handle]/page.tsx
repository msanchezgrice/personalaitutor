import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthSeed } from "@/lib/auth";
import { runtimeFindUserByHandle, runtimeFindUserById, runtimeListProjectsByUser } from "@/lib/runtime";
import {
  BRAND_NAME,
  BRAND_X_HANDLE,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
  getSiteUrl,
} from "@/lib/site";
import { EXAMPLE_PROFILE_HANDLE, exampleProfile, exampleProjects, prettyProjectState, safeHttpUrl, skillTone, stateTone } from "@/app/u/public-profile-utils";

export const revalidate = 300;

const shellClass = "rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]";
const mutedCardClass = "rounded-[24px] border border-slate-200 bg-[#f8fbfa] shadow-[0_16px_40px_rgba(15,23,42,0.05)]";
const secondaryButtonClass = "rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50";
const eyebrowClass = "inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em]";

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

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const view = await resolveProfileView(handle);
  const profile = view.profile;
  if (!profile || !view.canView) {
    notFound();
  }

  const projects = view.projects;
  const avatarUrl = safeHttpUrl(profile.avatarUrl ?? undefined) || profile.avatarUrl || "/assets/avatar.png";
  const linkedInUrl = safeHttpUrl(profile.socialLinks.linkedin);
  const websiteUrl = safeHttpUrl(profile.socialLinks.website);
  const githubUrl = safeHttpUrl(profile.socialLinks.github);
  const xUrl = safeHttpUrl(profile.socialLinks.x);
  const sortedSkills = [...profile.skills].sort((a, b) => b.score - a.score || b.evidenceCount - a.evidenceCount);
  const projectCount = projects.length;
  const proofCount = sortedSkills.reduce((sum, entry) => sum + entry.evidenceCount, 0);
  const verifiedCount = sortedSkills.filter((entry) => entry.status === "verified").length;
  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    description: profile.headline,
    url: `${getSiteUrl()}/u/${profile.handle}`,
    sameAs: [linkedInUrl, websiteUrl, githubUrl, xUrl].filter(Boolean),
    knowsAbout: sortedSkills.map((entry) => entry.skill),
  };

  const previewTone = view.isExample
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : profile.published
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <>
      <main className="min-h-screen bg-[#f4f8f5] text-slate-900">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_60%)] pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-6 py-8 md:px-10 md:py-10">
          <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <Link href="/" className="flex items-center gap-3 text-slate-900">
              <img src="/assets/branding/brand_brain_icon.svg" alt={BRAND_NAME} className="h-11 w-11 object-contain" />
              <span className="font-[Outfit] text-[1.7rem] font-semibold tracking-tight">{BRAND_NAME}</span>
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/employers/talent" className={secondaryButtonClass}>
                Browse Talent Pool
              </Link>
              <Link href="/dashboard/profile" className="rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.24)]">
                Dashboard
              </Link>
            </div>
          </header>

          <section className="mb-8 grid gap-6 xl:grid-cols-[1.25fr,0.75fr]">
            <div className={`${shellClass} p-8 md:p-10`}>
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                <img src={avatarUrl} alt={profile.name} className="h-28 w-28 rounded-[28px] border border-slate-200 object-cover shadow-[0_18px_44px_rgba(15,23,42,0.08)]" />
                <div className="min-w-0 flex-1">
                  <div className={`${eyebrowClass} ${previewTone} mb-4`}>
                    {view.isExample ? "Example profile" : profile.published ? "Public proof profile" : "Private owner preview"}
                  </div>
                  <h1 className="mb-3 font-[Outfit] text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-5xl">{profile.name}</h1>
                  <p className="mb-4 text-xl font-medium text-emerald-700">{profile.headline || "AI Builder"}</p>
                  <p className="mb-6 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">{profile.bio}</p>
                  <div className="flex flex-wrap gap-3">
                    {linkedInUrl ? (
                      <a href={linkedInUrl} target="_blank" rel="noreferrer" className="rounded-2xl bg-[#0a66c2] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(10,102,194,0.22)]">
                        LinkedIn
                      </a>
                    ) : null}
                    {websiteUrl ? (
                      <a href={websiteUrl} target="_blank" rel="noreferrer" className={secondaryButtonClass}>
                        Website
                      </a>
                    ) : null}
                    {githubUrl ? (
                      <a href={githubUrl} target="_blank" rel="noreferrer" className={secondaryButtonClass}>
                        GitHub
                      </a>
                    ) : null}
                    {xUrl ? (
                      <a href={xUrl} target="_blank" rel="noreferrer" className={secondaryButtonClass}>
                        X / Twitter
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
              <div className={`${mutedCardClass} p-6`}>
                <div className="mb-2 text-sm text-slate-500">Projects</div>
                <div className="font-[Outfit] text-4xl font-semibold text-slate-900">{projectCount}</div>
              </div>
              <div className={`${mutedCardClass} p-6`}>
                <div className="mb-2 text-sm text-slate-500">Verified skills</div>
                <div className="font-[Outfit] text-4xl font-semibold text-slate-900">{verifiedCount}</div>
              </div>
              <div className={`${mutedCardClass} p-6`}>
                <div className="mb-2 text-sm text-slate-500">Proof artifacts</div>
                <div className="font-[Outfit] text-4xl font-semibold text-slate-900">{proofCount}</div>
              </div>
            </div>
          </section>

          <section className="mb-8 grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
            <div className={`${shellClass} p-8`}>
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Verified skill stack</div>
                  <h2 className="font-[Outfit] text-3xl font-semibold tracking-tight text-slate-900">What this builder can prove</h2>
                </div>
              </div>
              {sortedSkills.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {sortedSkills.map((entry) => (
                    <div key={entry.skill} className="rounded-2xl border border-slate-200 bg-[#f8fbfa] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="font-medium text-slate-900">{entry.skill}</div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${skillTone(entry.status)}`}>
                          {entry.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                        <span>Confidence</span>
                        <span>{Math.round(entry.score * 100)}%</span>
                      </div>
                      <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${Math.max(8, Math.round(entry.score * 100))}%` }} />
                      </div>
                      <div className="text-xs text-slate-500">{entry.evidenceCount} proof artifact{entry.evidenceCount === 1 ? "" : "s"}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-[#f8fbfa] p-5 text-slate-600">
                  No skills have been verified on this profile yet.
                </div>
              )}
            </div>

            <div className={`${shellClass} bg-[#f8fbfa] p-8`}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Tooling and signals</div>
              <h2 className="mb-6 font-[Outfit] text-3xl font-semibold tracking-tight text-slate-900">Work context</h2>
              <div className="mb-8 flex flex-wrap gap-2">
                {profile.tools.length ? profile.tools.map((tool) => (
                  <span key={tool} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm">{tool}</span>
                )) : <span className="text-sm text-slate-500">No tools listed yet.</span>}
              </div>
              <div className="space-y-4 text-sm text-slate-600">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-400">Public URL</div>
                  <div className="break-all text-slate-700">{`${getSiteUrl()}/u/${profile.handle}`}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-400">Profile handle</div>
                  <div className="text-slate-700">@{profile.handle}</div>
                </div>
                {!profile.published ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
                    This is an owner preview. Publish from the dashboard to expose the profile publicly.
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className={`${shellClass} p-8`}>
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Project proof</div>
                <h2 className="font-[Outfit] text-3xl font-semibold tracking-tight text-slate-900">Recent builds and proof artifacts</h2>
              </div>
            </div>
            {projects.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {projects.map((project) => (
                  <a key={project.id} href={`/u/${profile.handle}/projects/${project.slug}/`} className="rounded-[24px] border border-slate-200 bg-[#f8fbfa] p-6 transition hover:border-emerald-300 hover:bg-white hover:shadow-[0_16px_40px_rgba(16,185,129,0.12)]">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <h3 className="font-[Outfit] text-2xl font-medium text-slate-900">{project.title}</h3>
                      <span className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stateTone(project.state)}`}>
                        {prettyProjectState(project.state)}
                      </span>
                    </div>
                    <p className="mb-5 leading-7 text-slate-600">{project.description}</p>
                    <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>{project.artifacts.length} artifact{project.artifacts.length === 1 ? "" : "s"}</span>
                      <span>•</span>
                      <span>{project.buildLog.length} build log entr{project.buildLog.length === 1 ? "y" : "ies"}</span>
                    </div>
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                      Open project proof <span aria-hidden>→</span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-[#f8fbfa] p-6 text-slate-600">
                No public projects are attached to this profile yet.
              </div>
            )}
          </section>
        </div>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }} />
    </>
  );
}
