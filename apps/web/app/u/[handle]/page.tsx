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

  return (
    <>
      <main className="min-h-screen bg-[#07111f] text-white">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_58%)] pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-6 py-8 md:px-10 md:py-10">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-10">
            <Link href="/" className="flex items-center gap-3">
              <img src="/assets/branding/brand_brain_icon.svg" alt={BRAND_NAME} className="h-11 w-11 object-contain" />
              <span className="font-[Outfit] text-[1.7rem] font-semibold tracking-tight">{BRAND_NAME}</span>
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/employers/talent" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-200 hover:bg-white/5 transition">
                Browse Talent Pool
              </Link>
              <Link href="/dashboard/profile" className="rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(16,185,129,0.28)]">
                Dashboard
              </Link>
            </div>
          </header>

          <section className="grid gap-6 xl:grid-cols-[1.25fr,0.75fr] mb-8">
            <div className="rounded-[30px] border border-white/10 bg-white/5 p-8 shadow-[0_24px_80px_rgba(2,6,23,0.35)] backdrop-blur-xl">
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                <img src={avatarUrl} alt={profile.name} className="h-28 w-28 rounded-[28px] object-cover border border-white/10 shadow-[0_18px_44px_rgba(2,6,23,0.28)]" />
                <div className="min-w-0 flex-1">
                  <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200 mb-4">
                    {view.isExample ? "Example profile" : profile.published ? "Public proof profile" : "Private owner preview"}
                  </div>
                  <h1 className="font-[Outfit] text-4xl md:text-5xl font-semibold tracking-tight leading-tight mb-3">{profile.name}</h1>
                  <p className="text-xl text-emerald-200 mb-4">{profile.headline || "AI Builder"}</p>
                  <p className="max-w-3xl text-slate-300 text-base md:text-lg leading-8 mb-6">{profile.bio}</p>
                  <div className="flex flex-wrap gap-3">
                    {linkedInUrl ? (
                      <a href={linkedInUrl} target="_blank" rel="noreferrer" className="rounded-2xl bg-[#0a66c2] px-5 py-3 text-sm font-semibold text-white">
                        LinkedIn
                      </a>
                    ) : null}
                    {websiteUrl ? (
                      <a href={websiteUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-200 hover:bg-white/5 transition">
                        Website
                      </a>
                    ) : null}
                    {githubUrl ? (
                      <a href={githubUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-200 hover:bg-white/5 transition">
                        GitHub
                      </a>
                    ) : null}
                    {xUrl ? (
                      <a href={xUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-200 hover:bg-white/5 transition">
                        X / Twitter
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-[24px] border border-white/10 bg-[#0b1728] p-6">
                <div className="text-sm text-slate-400 mb-2">Projects</div>
                <div className="font-[Outfit] text-4xl font-semibold text-white">{projectCount}</div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-[#0b1728] p-6">
                <div className="text-sm text-slate-400 mb-2">Verified skills</div>
                <div className="font-[Outfit] text-4xl font-semibold text-white">{verifiedCount}</div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-[#0b1728] p-6">
                <div className="text-sm text-slate-400 mb-2">Proof artifacts</div>
                <div className="font-[Outfit] text-4xl font-semibold text-white">{proofCount}</div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr] mb-8">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_20px_64px_rgba(2,6,23,0.28)]">
              <div className="flex items-center justify-between gap-3 mb-6">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200 mb-2">Verified skill stack</div>
                  <h2 className="font-[Outfit] text-3xl font-semibold tracking-tight">What this builder can prove</h2>
                </div>
              </div>
              {sortedSkills.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {sortedSkills.map((entry) => (
                    <div key={entry.skill} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="font-medium text-white">{entry.skill}</div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${skillTone(entry.status)}`}>
                          {entry.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-xs text-slate-400 mb-2">
                        <span>Confidence</span>
                        <span>{Math.round(entry.score * 100)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-3">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${Math.max(8, Math.round(entry.score * 100))}%` }} />
                      </div>
                      <div className="text-xs text-slate-400">{entry.evidenceCount} proof artifact{entry.evidenceCount === 1 ? "" : "s"}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-slate-300">
                  No skills have been verified on this profile yet.
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#0b1728] p-8 shadow-[0_20px_64px_rgba(2,6,23,0.28)]">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200 mb-2">Tooling and signals</div>
              <h2 className="font-[Outfit] text-3xl font-semibold tracking-tight mb-6">Work context</h2>
              <div className="flex flex-wrap gap-2 mb-8">
                {profile.tools.length ? profile.tools.map((tool) => (
                  <span key={tool} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200">{tool}</span>
                )) : <span className="text-slate-400 text-sm">No tools listed yet.</span>}
              </div>
              <div className="space-y-4 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">Public URL</div>
                  <div className="break-all">{`${getSiteUrl()}/u/${profile.handle}`}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-2">Profile handle</div>
                  <div>@{profile.handle}</div>
                </div>
                {!profile.published ? (
                  <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-amber-100">
                    This is an owner preview. Publish from the dashboard to expose the profile publicly.
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_20px_64px_rgba(2,6,23,0.28)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200 mb-2">Project proof</div>
                <h2 className="font-[Outfit] text-3xl font-semibold tracking-tight">Recent builds and proof artifacts</h2>
              </div>
            </div>
            {projects.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {projects.map((project) => (
                  <a key={project.id} href={`/u/${profile.handle}/projects/${project.slug}/`} className="rounded-[24px] border border-white/10 bg-[#0b1728]/90 p-6 hover:border-emerald-400/35 hover:bg-[#0f1c31] transition">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <h3 className="font-[Outfit] text-2xl font-medium text-white">{project.title}</h3>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${stateTone(project.state)}`}>
                        {prettyProjectState(project.state)}
                      </span>
                    </div>
                    <p className="text-slate-300 leading-7 mb-5">{project.description}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-400 mb-4">
                      <span>{project.artifacts.length} artifact{project.artifacts.length === 1 ? "" : "s"}</span>
                      <span>•</span>
                      <span>{project.buildLog.length} build log entr{project.buildLog.length === 1 ? "y" : "ies"}</span>
                    </div>
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300">
                      Open project proof <span aria-hidden>→</span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-slate-300">
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
