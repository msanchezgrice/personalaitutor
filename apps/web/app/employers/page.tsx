import Link from "next/link";
import { TopNav } from "@/components/nav";

export default function EmployersPage() {
  return (
    <>
      <TopNav />
      <main className="container section">
        <h1>Employer Portal</h1>
        <p className="lead">100% System-Verified Skill Proofs with project cards, build logs, and tool-level evidence.</p>

        <section className="grid-3" style={{ marginTop: 14 }}>
          <article className="card">
            <h3>Profiles of users with skills</h3>
            <p>Upwork-style skills + tools, but backed by real project evidence from build logs and artifacts.</p>
          </article>
          <article className="card">
            <h3>Find verified AI talent</h3>
            <p>Filter by role track, module completion, skill status, and tool familiarity from a shared matrix source.</p>
          </article>
          <article className="card">
            <h3>How verification works</h3>
            <p>Candidates complete modules and build with AI Tutor agents. Verification events are persisted and auditable.</p>
          </article>
        </section>

        <section className="panel pad" style={{ marginTop: 14 }}>
          <h3>Verification model</h3>
          <ol className="list">
            <li>`in_progress`: module started or active build underway.</li>
            <li>`built`: output shipped with evidence and artifact linkage.</li>
            <li>`verified`: policy thresholds met with System-Verified validation.</li>
          </ol>
          <div className="hero-actions" style={{ marginTop: 12 }}>
            <Link className="btn primary" href="/employers/talent">Open Talent Marketplace</Link>
            <Link className="btn" href="/">Back to Learner Site</Link>
          </div>
        </section>
      </main>
    </>
  );
}
