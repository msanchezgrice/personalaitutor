import type { Metadata } from "next";
import { runtimeFindProjectBySlug, runtimeFindUserByHandle } from "@/lib/runtime";
import { TopNav } from "@/components/nav";

export async function generateMetadata({ params }: { params: Promise<{ handle: string; projectSlug: string }> }): Promise<Metadata> {
  const { handle, projectSlug } = await params;
  const profile = await runtimeFindUserByHandle(handle);
  const project = await runtimeFindProjectBySlug(projectSlug);

  if (!profile || !project || project.userId !== profile.id) {
    return { title: "Project not found" };
  }

  return {
    title: `${project.title} | ${profile.name}`,
    description: project.description,
    alternates: { canonical: `/u/${handle}/projects/${projectSlug}` },
    openGraph: {
      title: `${project.title} | project proof`,
      description: `System-Verified project proof for ${project.title}`,
      url: `/u/${handle}/projects/${projectSlug}`,
      type: "article",
      images: [{ url: `/api/og/project/${handle}/${projectSlug}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${project.title} | project proof`,
      description: project.description,
      images: [`/api/og/project/${handle}/${projectSlug}`],
    },
  };
}

export default async function PublicProjectPage({ params }: { params: Promise<{ handle: string; projectSlug: string }> }) {
  const { handle, projectSlug } = await params;
  const profile = await runtimeFindUserByHandle(handle);
  const project = await runtimeFindProjectBySlug(projectSlug);

  if (!profile || !project || project.userId !== profile.id) {
    return (
      <>
        <TopNav />
        <main className="container section">
          <h1>Project not found</h1>
          <p className="lead">The requested project does not exist for this profile.</p>
        </main>
      </>
    );
  }

  const creativeWorkLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    description: project.description,
    url: `http://localhost:6396/u/${handle}/projects/${projectSlug}`,
    creator: {
      "@type": "Person",
      name: profile.name,
    },
  };

  return (
    <>
      <TopNav />
      <main className="section">
        <div className="container" style={{ maxWidth: 980 }}>
          <section className="panel pad">
            <h1 style={{ fontSize: "3.2rem" }}>{project.title}</h1>
            <p className="lead">System-Verified Proof of Work for {profile.name}.</p>
            <p className="lead">{project.description}</p>
            <div className="hero-actions">
              <span className="tag warn">Build Log</span>
              <span className="tag">{project.state}</span>
            </div>
          </section>

          <section className="panel pad" style={{ marginTop: 14 }}>
            <h3>Project artifacts</h3>
            <ul className="list">
              {project.artifacts.map((artifact) => (
                <li key={`${artifact.kind}-${artifact.url}`}>
                  {artifact.kind}: <code>{artifact.url}</code>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel pad" style={{ marginTop: 14 }}>
            <h3>Build timeline</h3>
            <ul className="list">
              {project.buildLog.length ? (
                project.buildLog.map((entry) => (
                  <li key={entry.id}>
                    [{entry.level}] {entry.message} ({new Date(entry.createdAt).toLocaleString()})
                  </li>
                ))
              ) : (
                <li>No build log entries yet.</li>
              )}
            </ul>
          </section>

          <section className="panel pad" style={{ marginTop: 14 }}>
            <h3>Share metadata</h3>
            <p><strong>Public URL:</strong> <code>http://localhost:6396/u/{handle}/projects/{projectSlug}</code></p>
            <p><strong>OG URL:</strong> <code>http://localhost:6396/api/og/project/{handle}/{projectSlug}</code></p>
          </section>

          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(creativeWorkLd) }} />
        </div>
      </main>
    </>
  );
}
