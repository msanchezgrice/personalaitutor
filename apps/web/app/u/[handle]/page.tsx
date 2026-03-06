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
import {
  EXAMPLE_PROFILE_HANDLE,
  exampleProfile,
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

  const previewLabel = view.isExample
    ? "Example profile"
    : profile.published
      ? "Public proof profile"
      : "Private owner preview";

  return (
    <>
      <main data-gemini-shell="1" className="relative min-h-screen flex flex-col pt-20">
        <div className="bg-glow top-[-200px] left-[-120px] opacity-45"></div>
        <div
          className="bg-glow top-[18%] right-[-220px] opacity-35"
          style={{ background: "radial-gradient(circle, var(--secondary-glow) 0%, rgba(0,0,0,0) 70%)" }}
        ></div>

        <header className="glass fixed top-0 z-50 w-full rounded-none border-x-0 border-t-0 bg-opacity-80 backdrop-blur-xl">
          <div className="container nav py-4">
            <Link href="/" className="flex items-center gap-2">
              <img src="/assets/branding/brand_wordmark_logo.png" alt={BRAND_NAME} className="h-8 w-auto object-contain" />
            </Link>
            <div className="flex gap-4">
              <Link href="/employers/talent" className="btn btn-secondary py-2 px-4 shadow-none">
                Browse Talent Pool
              </Link>
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
                  <p className="mb-5 text-lg font-medium text-emerald-400">{profile.headline || "AI Builder"}</p>
                  <p className="max-w-2xl border-l-2 border-white/10 py-1 pl-4 text-sm leading-relaxed text-gray-300 md:text-base">
                    {profile.bio}
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
                <div className="glass p-6 rounded-2xl border border-white/10 bg-black/30">
                  <p className="mb-2 text-sm text-gray-400">Projects</p>
                  <div className="text-4xl font-[Outfit] text-white">{projectCount}</div>
                </div>
                <div className="glass p-6 rounded-2xl border border-white/10 bg-black/30">
                  <p className="mb-2 text-sm text-gray-400">Verified skills</p>
                  <div className="text-4xl font-[Outfit] text-white">{verifiedCount}</div>
                </div>
                <div className="glass p-6 rounded-2xl border border-white/10 bg-black/30">
                  <p className="mb-2 text-sm text-gray-400">Proof artifacts</p>
                  <div className="text-4xl font-[Outfit] text-white">{proofCount}</div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-8">
              <section className="glass sticky top-28 rounded-2xl p-6">
                <h2 className="mb-6 flex items-center gap-2 border-b border-white/10 pb-3 text-lg font-[Outfit] text-white">
                  <i className="fa-solid fa-layer-group text-teal-400"></i>
                  Verified Skill Stack
                </h2>
                <div className="space-y-6">
                  <div>
                    <div className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Core competencies</div>
                    <div className="flex flex-wrap gap-2">
                      {sortedSkills.length ? sortedSkills.map((entry) => (
                        <div key={entry.skill} className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
                          <i className={`fa-solid ${entry.status === "verified" ? "fa-award" : entry.status === "built" ? "fa-check-double" : "fa-wave-square"} text-xs text-emerald-400`}></i>
                          <span className="text-sm font-medium text-white">{entry.skill}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${skillTone(entry.status)}`}>
                            {Math.round(entry.score * 100)}%
                          </span>
                        </div>
                      )) : <span className="text-sm text-gray-400">No verified skills yet.</span>}
                    </div>
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
                    <p className="text-xs text-gray-400">Skills and proof signals are grounded in shipped work, artifacts, and build telemetry.</p>
                  </div>
                </div>
              </section>

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

            <section className="space-y-8 lg:col-span-2">
              <h2 className="flex items-center gap-3 text-2xl font-[Outfit] text-white">
                <i className="fa-solid fa-folder-tree text-amber-400"></i>
                Project Portfolio
              </h2>

              {projects.length ? (
                projects.map((project) => (
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
                        <p className="mb-4 line-clamp-3 text-sm text-gray-400">{project.description}</p>
                        <div className="flex flex-wrap gap-2 text-[10px]">
                          <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-gray-400">{project.artifacts.length} artifact{project.artifacts.length === 1 ? "" : "s"}</span>
                          <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-gray-400">{project.buildLog.length} build log entr{project.buildLog.length === 1 ? "y" : "ies"}</span>
                        </div>
                      </div>
                    </div>
                  </a>
                ))
              ) : (
                <div className="glass rounded-2xl p-6 text-gray-400">
                  No public projects are attached to this profile yet.
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }} />
    </>
  );
}
