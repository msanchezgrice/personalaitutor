import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
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
  EXAMPLE_PROJECT_SLUG,
  exampleProfile,
  exampleProjects,
  prettyProjectState,
  safeHttpUrl,
  stateTone,
} from "@/app/u/public-profile-utils";

export const revalidate = 300;

async function resolveProjectView(handle: string, projectSlug: string) {
  const profile = await runtimeFindUserByHandle(handle);
  if (handle === EXAMPLE_PROFILE_HANDLE && projectSlug === EXAMPLE_PROJECT_SLUG && (!profile || !profile.published)) {
    const sampleProfile = exampleProfile();
    const sampleProject = exampleProjects().find((entry) => entry.slug === projectSlug) ?? exampleProjects()[0];
    return { profile: sampleProfile, project: sampleProject, canView: true, isExample: true };
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
    return { profile: null, project: null, canView: false, isExample: false };
  }

  const projects = await runtimeListProjectsByUser(profile.id);
  const project = projects.find((entry) => entry.slug === projectSlug) ?? null;
  if (!project && projectSlug === EXAMPLE_PROJECT_SLUG && projects[0]) {
    redirect((`/u/${profile.handle}/projects/${projects[0].slug}/`) as never);
  }

  return { profile, project, canView: Boolean(project), isExample: false };
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string; projectSlug: string }> }): Promise<Metadata> {
  const { handle, projectSlug } = await params;
  const view = await resolveProjectView(handle, projectSlug);
  if (!view.profile || !view.project) {
    return {
      title: "Project not found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return {
    title: `${view.project.title} | ${view.profile.name}`,
    description: view.project.description,
    alternates: { canonical: `/u/${view.profile.handle}/projects/${view.project.slug}` },
    openGraph: {
      title: `${view.project.title} | project proof`,
      description: `System-verified project proof for ${view.project.title}`,
      url: `/u/${view.profile.handle}/projects/${view.project.slug}`,
      type: "article",
      images: [
        {
          url: DEFAULT_OG_IMAGE_PATH,
          width: DEFAULT_OG_IMAGE_WIDTH,
          height: DEFAULT_OG_IMAGE_HEIGHT,
          alt: DEFAULT_OG_IMAGE_ALT,
          type: "image/png",
        },
        {
          url: `/api/og/project/${view.profile.handle}/${view.project.slug}`,
          width: DEFAULT_OG_IMAGE_WIDTH,
          height: DEFAULT_OG_IMAGE_HEIGHT,
          alt: `${view.project.title} project preview`,
          type: "image/svg+xml",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: BRAND_X_HANDLE,
      creator: BRAND_X_HANDLE,
      title: `${view.project.title} | project proof`,
      description: view.project.description,
      images: [DEFAULT_OG_IMAGE_PATH],
    },
    robots: view.profile.published ? undefined : { index: false, follow: false },
  };
}

export default async function PublicProjectPage({ params }: { params: Promise<{ handle: string; projectSlug: string }> }) {
  const { handle, projectSlug } = await params;
  const view = await resolveProjectView(handle, projectSlug);
  if (!view.profile || !view.project || !view.canView) {
    notFound();
  }

  const profile = view.profile;
  const project = view.project;
  const avatarUrl = safeHttpUrl(profile.avatarUrl ?? undefined) || profile.avatarUrl || "/assets/avatar.png";
  const creativeWorkLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    description: project.description,
    url: `${getSiteUrl()}/u/${profile.handle}/projects/${project.slug}`,
    creator: {
      "@type": "Person",
      name: profile.name,
      url: `${getSiteUrl()}/u/${profile.handle}`,
    },
  };

  return (
    <>
      <main data-gemini-shell="1" className="gemini-light-shell public-project-shell relative min-h-screen flex flex-col pt-20">
        <div className="bg-glow top-[-200px] left-[-120px] opacity-45"></div>
        <div
          className="bg-glow top-[18%] right-[-220px] opacity-35"
          style={{ background: "radial-gradient(circle, var(--secondary-glow) 0%, rgba(0,0,0,0) 70%)" }}
        ></div>

        <header className="glass fixed top-0 z-50 w-full rounded-none border-x-0 border-t-0 bg-opacity-80 backdrop-blur-xl">
          <div className="container nav py-4">
            <a href={`/u/${profile.handle}/`} className="flex items-center gap-2 text-gray-400 hover:text-white transition">
              <i className="fa-solid fa-arrow-left"></i>
              <span>Back to {profile.name}</span>
            </a>
            <div className="flex gap-4">
              <a href={`/u/${profile.handle}/`} className="btn btn-secondary py-2 px-4 shadow-none">View Profile</a>
              <a href="/dashboard/projects" className="btn btn-primary py-2 px-4 shadow-[0_4px_14px_0_var(--primary-glow)]">Dashboard</a>
            </div>
          </div>
        </header>

        <div className="container max-w-6xl flex-grow py-12">
          <section className="glass-panel relative mb-10 overflow-hidden p-8 md:p-10">
            <div className="pointer-events-none absolute right-0 top-0 translate-x-4 -translate-y-4 p-8 opacity-10">
              <i className={`fa-solid ${project.state === "building" ? "fa-headset" : project.state === "built" || project.state === "showcased" ? "fa-spider" : "fa-diagram-project"} text-[150px] text-emerald-500`}></i>
            </div>

            <div className="relative z-10 grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
              <div>
                <span className={`mb-4 inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] ${stateTone(project.state)}`}>
                  {prettyProjectState(project.state)}
                </span>
                <h1 className="mb-3 text-4xl font-[Outfit] text-white md:text-5xl">{project.title}</h1>
                <p className="max-w-3xl text-base leading-8 text-gray-300 md:text-lg">{project.description}</p>
              </div>

              <div className="glass rounded-2xl border border-white/10 bg-black/30 p-6">
                <div className="mb-4 flex items-start gap-4">
                  <img src={avatarUrl} alt={profile.name} className="h-20 w-20 rounded-xl border border-white/20 object-cover" />
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Builder</div>
                    <h2 className="font-[Outfit] text-2xl text-white">{profile.name}</h2>
                    <p className="text-emerald-400">{profile.headline || "AI Builder"}</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="mb-1 text-xs uppercase tracking-[0.16em] text-gray-500">Artifacts</div>
                    <div className="text-3xl font-[Outfit] text-white">{project.artifacts.length}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="mb-1 text-xs uppercase tracking-[0.16em] text-gray-500">Build log</div>
                    <div className="text-3xl font-[Outfit] text-white">{project.buildLog.length}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="mb-1 text-xs uppercase tracking-[0.16em] text-gray-500">Public URL</div>
                    <div className="break-all text-sm text-gray-300">{`${getSiteUrl()}/u/${profile.handle}/projects/${project.slug}`}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-8 xl:grid-cols-[1.1fr,0.9fr]">
            <section className="glass rounded-2xl p-8">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-[Outfit] text-white">
                <i className="fa-solid fa-timeline text-cyan-400"></i>
                Execution history
              </h2>
              {project.buildLog.length ? (
                <div className="space-y-4">
                  {project.buildLog.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-white/10 bg-black/30 p-5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${entry.level === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : entry.level === "warn" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : entry.level === "error" ? "border-rose-500/30 bg-rose-500/10 text-rose-400" : "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"}`}>
                          {entry.level}
                        </span>
                        <span className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm leading-7 text-gray-300">{entry.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/30 p-5 text-gray-400">No build-log entries are attached to this project yet.</div>
              )}
            </section>

            <section className="glass rounded-2xl p-8">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-[Outfit] text-white">
                <i className="fa-solid fa-paperclip text-amber-400"></i>
                Attached outputs
              </h2>
              {project.artifacts.length ? (
                <div className="space-y-3">
                  {project.artifacts.map((artifact, index) => (
                    <a
                      key={`${artifact.kind}-${artifact.url}-${index}`}
                      href={artifact.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl border border-white/10 bg-black/30 p-4 transition hover:bg-white/5 hover:border-emerald-500/30"
                    >
                      <div className="mb-1 text-xs uppercase tracking-[0.18em] text-gray-500">{artifact.kind}</div>
                      <div className="break-all text-sm text-gray-300">{artifact.url}</div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/30 p-5 text-gray-400">No public artifacts are attached yet.</div>
              )}
            </section>
          </div>
        </div>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(creativeWorkLd) }} />
    </>
  );
}
