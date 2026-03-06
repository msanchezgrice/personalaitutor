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

const shellClass = "rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]";
const mutedCardClass = "rounded-2xl border border-slate-200 bg-[#f8fbfa]";
const secondaryButtonClass = "rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50";

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
      <main className="min-h-screen bg-[#f4f8f5] text-slate-900">
        <div className="absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_58%)] pointer-events-none" />
        <div className="relative mx-auto max-w-6xl px-6 py-8 md:px-10 md:py-10">
          <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <a href={`/u/${profile.handle}/`} className="text-sm font-medium text-emerald-700 transition hover:text-emerald-800">← Back to {profile.name}</a>
              <h1 className="mt-3 mb-3 font-[Outfit] text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">{project.title}</h1>
              <p className="max-w-3xl text-lg leading-8 text-slate-600">{project.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${stateTone(project.state)}`}>
                {prettyProjectState(project.state)}
              </span>
              <a href={`/u/${profile.handle}/`} className={secondaryButtonClass}>
                View Profile
              </a>
            </div>
          </header>

          <section className="mb-8 grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
            <div className={`${shellClass} p-8`}>
              <div className="mb-6 flex items-start gap-4">
                <img src={avatarUrl} alt={profile.name} className="h-20 w-20 rounded-[24px] border border-slate-200 object-cover shadow-sm" />
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Builder</div>
                  <h2 className="font-[Outfit] text-2xl font-semibold text-slate-900">{profile.name}</h2>
                  <p className="text-emerald-700">{profile.headline || "AI Builder"}</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className={`${mutedCardClass} p-4`}>
                  <div className="mb-2 text-sm text-slate-500">Artifacts</div>
                  <div className="font-[Outfit] text-3xl font-semibold text-slate-900">{project.artifacts.length}</div>
                </div>
                <div className={`${mutedCardClass} p-4`}>
                  <div className="mb-2 text-sm text-slate-500">Build log</div>
                  <div className="font-[Outfit] text-3xl font-semibold text-slate-900">{project.buildLog.length}</div>
                </div>
                <div className={`${mutedCardClass} p-4`}>
                  <div className="mb-2 text-sm text-slate-500">Public URL</div>
                  <div className="break-all text-sm text-slate-700">{`${getSiteUrl()}/u/${profile.handle}/projects/${project.slug}`}</div>
                </div>
              </div>
            </div>

            <div className={`${shellClass} bg-[#f8fbfa] p-8`}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Project status</div>
              <h2 className="mb-5 font-[Outfit] text-3xl font-semibold tracking-tight text-slate-900">Current signal</h2>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 leading-7 text-slate-600">
                {project.state === "building"
                  ? "This project is actively being built and the proof page updates as new artifacts and build-log entries arrive."
                  : project.state === "built" || project.state === "showcased"
                    ? "This project has shipped enough work to show public execution proof."
                    : "This project is in setup and planning mode. Public proof will deepen as work lands."}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
            <div className={`${shellClass} p-8`}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Build log</div>
              <h2 className="mb-6 font-[Outfit] text-3xl font-semibold tracking-tight text-slate-900">Execution history</h2>
              {project.buildLog.length ? (
                <div className="space-y-4">
                  {project.buildLog.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-slate-200 bg-[#f8fbfa] p-5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${entry.level === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : entry.level === "warn" ? "border-amber-200 bg-amber-50 text-amber-700" : entry.level === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-sky-200 bg-sky-50 text-sky-700"}`}>
                          {entry.level}
                        </span>
                        <span className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="leading-7 text-slate-700">{entry.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-[#f8fbfa] p-5 text-slate-600">
                  No build-log entries are attached to this project yet.
                </div>
              )}
            </div>

            <div className={`${shellClass} bg-[#f8fbfa] p-8`}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Artifacts</div>
              <h2 className="mb-6 font-[Outfit] text-3xl font-semibold tracking-tight text-slate-900">Attached outputs</h2>
              {project.artifacts.length ? (
                <div className="space-y-3">
                  {project.artifacts.map((artifact, index) => (
                    <a
                      key={`${artifact.kind}-${artifact.url}-${index}`}
                      href={artifact.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40"
                    >
                      <div className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-400">{artifact.kind}</div>
                      <div className="break-all text-sm text-slate-700">{artifact.url}</div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600">
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
