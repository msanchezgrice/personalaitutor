import type { Metadata } from "next";
import Link from "next/link";
import { runtimeFindUserByHandle, runtimeListProjectsByUser } from "@/lib/runtime";
import { TopNav } from "@/components/nav";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const profile = await runtimeFindUserByHandle(handle);
  if (!profile) {
    return { title: "Profile not found" };
  }

  return {
    title: `${profile.name} | AI Tutor Profile`,
    description: profile.bio,
    alternates: { canonical: `/u/${profile.handle}` },
    openGraph: {
      title: `${profile.name} | AI Tutor Profile`,
      description: profile.bio,
      url: `/u/${profile.handle}`,
      type: "profile",
      images: [{ url: `/api/og/profile/${profile.handle}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${profile.name} | AI Tutor Profile`,
      description: profile.bio,
      images: [`/api/og/profile/${profile.handle}`],
    },
  };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await runtimeFindUserByHandle(handle);

  if (!profile) {
    return (
      <>
        <TopNav />
        <main className="container section">
          <h1>Profile not found</h1>
          <p className="lead">The requested handle does not exist.</p>
        </main>
      </>
    );
  }

  const projects = await runtimeListProjectsByUser(profile.id);
  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    description: profile.headline,
    url: `http://localhost:6396/u/${profile.handle}`,
    sameAs: Object.values(profile.socialLinks).filter(Boolean),
    knowsAbout: profile.skills.map((entry) => entry.skill),
  };

  return (
    <>
      <TopNav />
      <main className="section">
        <div className="container" style={{ maxWidth: 1080 }}>
          <section className="panel pad" style={{ padding: 24 }}>
            <h1 style={{ fontSize: "3rem" }}>{profile.name}</h1>
            <p className="lead">{profile.headline}</p>
            <p className="lead">{profile.bio}</p>
            <div className="hero-actions">
              <span className="tag ok">AI Tutor Verified</span>
              <span className="tag">Tokens used: {profile.tokensUsed}</span>
            </div>
          </section>

          <div className="grid-3" style={{ marginTop: 16, alignItems: "start" }}>
            <section className="panel pad">
              <h3>Platform Verified Skills</h3>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {profile.skills.map((entry) => (
                  <div key={entry.skill} className="card">
                    <strong>{entry.skill}</strong>
                    <p>
                      Status: {entry.status} · Score: {entry.score.toFixed(2)} · Evidence: {entry.evidenceCount}
                    </p>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 10 }}><strong>Tools:</strong> {profile.tools.join(", ")}</p>
              <p><strong>Goals:</strong> {profile.goals.join(", ")}</p>
            </section>

            <section className="panel pad" style={{ gridColumn: "span 2" }}>
              <h3>Projects</h3>
              <div className="grid-2" style={{ marginTop: 10 }}>
                {projects.map((project) => (
                  <article key={project.id} className="card">
                    <h4>{project.title}</h4>
                    <p>{project.description}</p>
                    <p><strong>State:</strong> {project.state}</p>
                    <p><strong>Artifacts:</strong> {project.artifacts.length}</p>
                    <Link className="btn" href={`/u/${profile.handle}/projects/${project.slug}`}>
                      Open project card
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <section className="panel pad" style={{ marginTop: 16 }}>
            <h3>Social Links</h3>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {profile.socialLinks.linkedin ? (
                <a className="btn" href={profile.socialLinks.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
              ) : null}
              {profile.socialLinks.x ? (
                <a className="btn" href={profile.socialLinks.x} target="_blank" rel="noreferrer">X</a>
              ) : null}
              {profile.socialLinks.website ? (
                <a className="btn" href={profile.socialLinks.website} target="_blank" rel="noreferrer">Website</a>
              ) : null}
              {profile.socialLinks.github ? (
                <a className="btn" href={profile.socialLinks.github} target="_blank" rel="noreferrer">GitHub</a>
              ) : null}
            </div>
          </section>

          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }} />
        </div>
      </main>
    </>
  );
}
