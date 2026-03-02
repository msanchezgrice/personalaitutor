import Link from "next/link";
import { runtimeGetTalentByHandle } from "@/lib/runtime";
import { TopNav } from "@/components/nav";

export default async function TalentDetailPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const candidate = await runtimeGetTalentByHandle(handle);

  if (!candidate) {
    return (
      <>
        <TopNav />
        <main className="container section">
          <h1>Candidate not found</h1>
          <p className="lead">Invalid handle for talent profile.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <TopNav />
      <main className="container section">
        <h1>{candidate.name}</h1>
        <p className="lead">{candidate.role} - {candidate.careerType}</p>

        <section className="panel" style={{ marginTop: 14 }}>
          <p><strong>Status:</strong> {candidate.status}</p>
          <p><strong>Top skills:</strong> {candidate.topSkills.join(", ")}</p>
          <p><strong>Top tools:</strong> {candidate.topTools.join(", ")}</p>
          <p><strong>Evidence score:</strong> {candidate.evidenceScore}</p>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn" href="/u/test-user-0001">Open equivalent learner profile</Link>
            <a className="btn primary" href="/employers/talent">
              Back to Talent Search
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
