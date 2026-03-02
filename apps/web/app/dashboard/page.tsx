import Link from "next/link";
import { TopNav } from "@/components/nav";
import { DashboardOverview } from "@/components/dashboard-overview";

export default function DashboardPage() {
  return (
    <>
      <TopNav />
      <main className="split container">
        <aside className="sidebar">
          <h3>AI Tutor Workspace</h3>
          <p className="lead" style={{ fontSize: ".92rem", marginTop: 6 }}>
            <strong>TEST_USER_0001</strong> · Product Management Track
          </p>
          <div className="side-links">
            <Link className="active" href="/dashboard">Overview</Link>
            <Link href="/dashboard/projects">My Projects</Link>
            <Link href="/dashboard/profile">My Online Profile</Link>
            <Link href="/dashboard/chat">Chat</Link>
            <Link href="/dashboard/social">LinkedIn/X Posts</Link>
            <Link href="/dashboard/updates">Daily Updates</Link>
          </div>
          <div className="card" style={{ marginTop: 10 }}>
            <h3>Verification Policy</h3>
            <p>
              Platform policy supports `in_progress` to `built` to `verified`. Failing dependencies block advancement
              with explicit recovery actions.
            </p>
          </div>
        </aside>

        <section className="content">
          <div className="kpi-grid">
            <div className="kpi"><span className="label">AI-Native Score</span><span className="value">58</span></div>
            <div className="kpi"><span className="label">Projects Built</span><span className="value">1</span></div>
            <div className="kpi"><span className="label">Verified Skills</span><span className="value">2</span></div>
            <div className="kpi"><span className="label">Tokens Used</span><span className="value">18430</span></div>
          </div>

          <div className="grid-2">
            <article className="panel pad">
              <h3>My Projects</h3>
              <table>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Artifacts</th>
                    <th>Skills</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>PROJECT_ALPHA_001</td>
                    <td><span className="tag warn">In Progress</span></td>
                    <td>Draft website</td>
                    <td>Prompting</td>
                  </tr>
                  <tr>
                    <td>PROJECT_BETA_002</td>
                    <td><span className="tag">Planned</span></td>
                    <td>None</td>
                    <td>Workflow Mapping</td>
                  </tr>
                  <tr>
                    <td>PROJECT_GAMMA_003</td>
                    <td><span className="tag">Planned</span></td>
                    <td>None</td>
                    <td>Documentation</td>
                  </tr>
                </tbody>
              </table>
              <div className="hero-actions">
                <Link className="btn" href="/dashboard/projects">Open Projects</Link>
              </div>
            </article>

            <article className="panel pad">
              <h3>My Online Profile</h3>
              <p>Private by default. Publish selected projects to your public profile and employer marketplace card.</p>
              <ul className="list">
                <li>Headline and role track stored</li>
                <li>Skills matrix drafted</li>
                <li>OG metadata generated</li>
                <li>Social links configured</li>
              </ul>
              <div className="hero-actions">
                <Link className="btn brand" href="/dashboard/profile">Edit Profile</Link>
                <Link className="btn" href="/u/test-user-0001">Preview Public URL</Link>
              </div>
            </article>
          </div>

          <div className="grid-2">
            <article className="panel pad">
              <h3>AI Tutor Chat Snapshot</h3>
              <div className="msg agent">Complete module 01 and publish one build-log entry for PROJECT_ALPHA_001.</div>
              <div className="hero-actions">
                <Link className="btn" href="/dashboard/chat">Open Chat</Link>
              </div>
            </article>

            <article className="panel pad">
              <h3>Relevant AI News</h3>
              <ul className="list">
                <li>Agent observability standards are becoming common in hiring screens.</li>
                <li>Evaluation pipelines for retrieval quality are now expected in many AI roles.</li>
                <li>Portfolio-based AI proof is replacing generic skill claims.</li>
              </ul>
              <div className="fail-box"><strong>Fail state sample:</strong> News refresh job failed. Retry required.</div>
            </article>
          </div>

          <DashboardOverview />
        </section>
      </main>
    </>
  );
}
