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
import { EXAMPLE_PROFILE_HANDLE, EXAMPLE_PROJECT_SLUG, exampleProfile, exampleProjects, prettyProjectState, safeHttpUrl, stateTone } from "@/app/u/public-profile-utils";

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
    redirect(("/u/" + profile.handle + "/projects/" + projects[0].slug + "/") as never);
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
      <main className="min-h-screen bg-[#07111f] text-white">
        <div className="absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_58%)] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6 py-8 md:px-10 md:py-10">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-10">
            <div>
              <a href={`/u/${profile.handle}/`} className="text-sm text-emerald-300 hover:text-emerald-200 transition">← Back to {profile.name}</a>
              <h1 className="font-[Outfit] text-4xl md:text-5xl font-semibold tracking-tight mt-3 mb-3">{project.title}</h1>
              <p className="max-w-3xl text-slate-300 text-lg leading-8">{project.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${stateTone(project.state)}`}>
                {prettyProjectState(project.state)}
              </span>
              <a href={`/u/${profile.handle}/`} className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-200 hover:bg-white/5 transition">
                View Profile
              </a>
            </div>
          </header>

          <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr] mb-8">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_24px_80px_rgba(2,6,23,0.35)]">
              <div className="flex items-start gap-4 mb-6">
                <img src={avatarUrl} alt={profile.name} className="h-20 w-20 rounded-[24px] object-cover border border-white/10" />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200 mb-2">Builder</div>
                  <h2 className="font-[Outfit] text-2xl font-semibold text-white">{profile.name}</h2>
                  <p className="text-emerald-200">{profile.headline || "AI Builder"}</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm text-slate-400 mb-2">Artifacts</div>
                  <div className="font-[Outfit] text-3xl font-semibold text-white">{project.artifacts.length}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm text-slate-400 mb-2">Build log</div>
                  <div className="font-[Outfit] text-3xl font-semibold text-white">{project.buildLog.length}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm text-slate-400 mb-2">Public URL</div>
                  <div className="text-sm text-slate-200 break-all">{`${getSiteUrl()}/u/${profile.handle}/projects/${project.slug}`}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#0b1728] p-8 shadow-[0_24px_80px_rgba(2,6,23,0.35)]">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200 mb-2">Project status</div>
              <h2 className="font-[Outfit] text-3xl font-semibold tracking-tight mb-5">Current signal</h2>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-slate-300 leading-7">
                {project.state === "building"
                  ? "This project is actively being built and the proof page updates as new artifacts and build-log entries arrive."
                  : project.state === "built" || project.state === "showcased"
                    ? "This project has shipped enough work to show public execution proof."
                    : "This project is in setup and planning mode. Public proof will deepen as work lands."}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-[0_20px_64px_rgba(2,6,23,0.28)]">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200 mb-2">Build log</div>
              <h2 className="font-[Outfit] text-3xl font-semibold tracking-tight mb-6">Execution history</h2>
              {project.buildLog.length ? (
                <div className="space-y-4">
                  {project.buildLog.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${entry.level === "success" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : entry.level === "warn" ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : entry.level === "error" ? "border-rose-400/30 bg-rose-400/10 text-rose-200" : "border-sky-400/30 bg-sky-400/10 text-sky-200"}`}>
                          {entry.level}
                        </span>
                        <span className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-200 leading-7">{entry.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-slate-300">
                  No build-log entries are attached to this project yet.
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#0b1728] p-8 shadow-[0_20px_64px_rgba(2,6,23,0.28)]">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200 mb-2">Artifacts</div>
              <h2 className="font-[Outfit] text-3xl font-semibold tracking-tight mb-6">Attached outputs</h2>
              {project.artifacts.length ? (
                <div className="space-y-3">
                  {project.artifacts.map((artifact, index) => (
                    <a
                      key={`${artifact.kind}-${artifact.url}-${index}`}
                      href={artifact.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl border border-white/10 bg-black/20 p-4 hover:bg-white/5 transition"
                    >
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1">{artifact.kind}</div>
                      <div className="text-sm text-slate-200 break-all">{artifact.url}</div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-slate-300">
                  No public artifacts are attached yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(creativeWorkLd) }} />
    </>
  );
}
