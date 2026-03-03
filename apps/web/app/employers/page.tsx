import Link from "next/link";
import { TopNav } from "@/components/nav";

export default function EmployersPage() {
  return (
    <>
      <TopNav />
      <main>
        <section className="hero">
          <div className="container" style={{ textAlign: "center", maxWidth: 980 }}>
            <span className="tag ok" style={{ marginBottom: 20 }}>
              100% System-Verified Skill Proofs
            </span>
            <h1>
              Hire talent that actually <br /> knows how to use AI.
            </h1>
            <p className="lead" style={{ margin: "16px auto 0", fontSize: "1.2rem" }}>
              Stop guessing from resumes. Access professionals who build, ship, and verify their AI competence through
              module completion and project telemetry.
            </p>

            <div className="hero-actions" style={{ justifyContent: "center", marginTop: 24 }}>
              <Link className="btn white" href="/employers/talent">
                Browse Talent Pool
              </Link>
              <a className="btn" href="mailto:talent@personalaitutor.ai">
                Post a Role
              </a>
            </div>

            <div className="grid-3" style={{ marginTop: 26, textAlign: "left" }}>
              <article className="card">
                <h3>See the Build Log</h3>
                <p>Audit prompts, fixes, architecture choices, and artifact outputs for every candidate.</p>
              </article>
              <article className="card">
                <h3>Verified Execution</h3>
                <p>Skills move from in_progress to built to verified through policy-driven checks.</p>
              </article>
              <article className="card">
                <h3>Instant ROI</h3>
                <p>Hire builders who can automate workflows, ship docs, and integrate APIs from day one.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container panel pad">
            <h2>Verification model</h2>
            <ol className="list">
              <li>`in_progress`: module started or active build underway.</li>
              <li>`built`: output shipped with evidence and artifact linkage.</li>
              <li>`verified`: policy thresholds met with system verification events.</li>
            </ol>
            <div className="hero-actions">
              <Link className="btn primary" href="/employers/talent">
                Open Talent Marketplace
              </Link>
              <Link className="btn" href="/">
                Back to Learner Site
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
