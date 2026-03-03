import Link from "next/link";
import { runtimeGetTalentByHandle } from "@/lib/runtime";

export default async function TalentDetailPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const candidate = await runtimeGetTalentByHandle(handle);

  if (!candidate) {
    return (
      <main className="container section">
        <h1>Candidate not found</h1>
        <p className="lead">Invalid handle for talent profile.</p>
      </main>
    );
  }

  return (
    <div className="dash-app">
      <aside className="dash-sidebar">
        <Link href="/employers" className="dash-brand">
          <span className="dash-brand-mark" style={{ background: "linear-gradient(145deg, var(--brand-2), var(--brand))" }}>CG</span>
          <span>Recruiter</span>
        </Link>
        <Link className="btn" href="/employers/talent">
          Back to Search
        </Link>
      </aside>

      <main className="dash-main">
        <section className="dash-header">
          <div>
            <h1 style={{ fontSize: "2rem" }}>{candidate.name}</h1>
            <p>{candidate.role} · {candidate.careerType}</p>
          </div>
          <div className="dash-header-actions">
            <Link className="btn" href="/u/test-user-0001" target="_blank">
              View Public Portfolio
            </Link>
          </div>
        </section>

        <section className="dash-body">
          <article className="dash-panel">
            <h2>System verification snapshot</h2>
            <div className="grid-2" style={{ marginTop: 10 }}>
              <div className="card">
                <p><strong>Status:</strong> {candidate.status}</p>
                <p><strong>Evidence score:</strong> {candidate.evidenceScore}</p>
              </div>
              <div className="card">
                <p><strong>Top skills:</strong> {candidate.topSkills.join(", ")}</p>
                <p><strong>Top tools:</strong> {candidate.topTools.join(", ")}</p>
              </div>
            </div>
          </article>

          <article className="dash-panel">
            <h2>Recruiter actions</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <button type="button" className="btn white">Message Candidate</button>
              <button type="button" className="btn">Save Profile</button>
              <Link className="btn" href="/employers/talent">Open Other Candidates</Link>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
