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
      <main className="container section">
        <h1>{profile.name}</h1>
        <p className="lead">{profile.headline}</p>
        <p className="lead">{profile.bio}</p>

        <section className="panel" style={{ marginTop: 14 }}>
          <h3>Platform Verified Skills</h3>
          <div className="grid-2" style={{ marginTop: 10 }}>
            {profile.skills.map((entry) => (
              <article className="card" key={entry.skill}>
                <strong>{entry.skill}</strong>
                <p style={{ marginTop: 6 }}>
                  Status: {entry.status} | Score: {entry.score.toFixed(2)} | Evidence: {entry.evidenceCount}
                </p>
              </article>
            ))}
          </div>
          <p style={{ marginTop: 12 }}><strong>Tools:</strong> {profile.tools.join(", ")}</p>
          <p><strong>Tokens used:</strong> {profile.tokensUsed}</p>
          <p><strong>Goals:</strong> {profile.goals.join(", ")}</p>
        </section>

        <section className="panel" style={{ marginTop: 14 }}>
          <h3>Projects</h3>
          <div className="grid-2" style={{ marginTop: 10 }}>
            {projects.map((project) => (
              <article key={project.id} className="card">
                <h4>{project.title}</h4>
                <p className="lead">{project.description}</p>
                <p><strong>State:</strong> {project.state}</p>
                <p><strong>Artifacts:</strong> {project.artifacts.length}</p>
                <Link className="btn" href={`/u/${profile.handle}/projects/${project.slug}`}>Open project card</Link>
              </article>
            ))}
          </div>
        </section>

        <section className="panel" style={{ marginTop: 14 }}>
          <h3>Social links</h3>
          <ul className="list">
            {profile.socialLinks.linkedin ? (
              <li><a href={profile.socialLinks.linkedin} target="_blank" rel="noreferrer">LinkedIn</a></li>
            ) : null}
            {profile.socialLinks.x ? (
              <li><a href={profile.socialLinks.x} target="_blank" rel="noreferrer">X</a></li>
            ) : null}
            {profile.socialLinks.website ? (
              <li><a href={profile.socialLinks.website} target="_blank" rel="noreferrer">Website</a></li>
            ) : null}
            {profile.socialLinks.github ? (
              <li><a href={profile.socialLinks.github} target="_blank" rel="noreferrer">GitHub</a></li>
            ) : null}
          </ul>
        </section>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }} />
      </main>
    </>
  );
}
