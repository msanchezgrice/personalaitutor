import Link from "next/link";
import { DashboardOverview } from "@/components/dashboard-overview";

export default function DashboardPage() {
  return (
    <>
      <section className="dash-header">
        <div>
          <h1 style={{ fontSize: "2rem" }}>Good Morning, Alex 👋</h1>
          <p>Ready to build something new today?</p>
        </div>
        <div className="dash-header-actions">
          <Link className="btn" href="/employers/talent">
            View Talent Board
          </Link>
        </div>
      </section>

      <section className="dash-body">
        <article className="dash-banner">
          <div>
            <h3>AI Tutor: Let&apos;s finish your automation workflow.</h3>
            <p>You left off at the data parsing step in the Customer Support Copilot project.</p>
          </div>
          <Link className="btn primary" href="/dashboard/chat">
            Resume Session
          </Link>
        </article>

        <div className="dash-grid-main">
          <div className="dash-stack">
            <article className="dash-panel">
              <h2>My Projects</h2>
              <div className="dash-project-cards">
                <div className="dash-project-card">
                  <span className="tag warn">In Progress</span>
                  <h3 style={{ marginTop: 10 }}>Customer Support Copilot</h3>
                  <p>An automated email responder using RAG to fetch CRM context before drafting replies.</p>
                  <div className="dash-meter">
                    <span />
                  </div>
                </div>

                <div className="dash-project-card" style={{ borderColor: "color-mix(in srgb, var(--ok), transparent 58%)" }}>
                  <span className="tag ok">Completed</span>
                  <h3 style={{ marginTop: 10 }}>Lead Scraper Pro</h3>
                  <p>Python script to map local businesses to a CSV using Google Maps APIs.</p>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <Link className="btn" href="/dashboard/projects">
                  Open Project Portfolio
                </Link>
              </div>
            </article>

            <article className="dash-panel">
              <h2>My Online Profile</h2>
              <p className="lead">Publish system-verified projects with social links, OG metadata, and skill evidence.</p>
              <div className="skill-chips">
                <span className="skill-chip ok">Platform Verified Skills</span>
                <span className="skill-chip">Build Log</span>
                <span className="skill-chip">Token Meter</span>
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link className="btn" href="/dashboard/profile">
                  Edit Profile
                </Link>
                <Link className="btn" href="/u/test-user-0001">
                  View Public URL
                </Link>
              </div>
            </article>

            <article className="dash-panel">
              <h2>AI Tutor Chat</h2>
              <p className="lead">Always-available tutor support with project event streams and deterministic fail-state recovery.</p>
              <div className="msg agent" style={{ marginTop: 10 }}>
                Continue module checkpoints and publish one build-log event from your active project.
              </div>
              <div style={{ marginTop: 12 }}>
                <Link className="btn primary" href="/dashboard/chat">
                  Open Chat Tutor
                </Link>
              </div>
            </article>
          </div>

          <div className="dash-stack">
            <article className="dash-panel">
              <h3>Social Drafts</h3>
              <p className="lead">Drafts generated from your latest project milestones.</p>
              <div className="msg" style={{ marginTop: 10 }}>
                "Finished my first automation workflow. Built with AI Tutor and published proof publicly."
              </div>
              <div style={{ marginTop: 10 }}>
                <Link className="btn primary" href="/dashboard/social">
                  Review and Publish
                </Link>
              </div>
            </article>

            <article className="dash-panel">
              <h3>AI Updates</h3>
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <div className="card">
                  <strong>Claude 3.5 Released</strong>
                  <p>New capabilities detected. Your tutor highlighted 3 workflows you can apply today.</p>
                </div>
                <div className="card" style={{ opacity: 0.7 }}>
                  <strong>Provider latency alert</strong>
                  <p>Expected slow response windows. Retry logic will auto-schedule jobs.</p>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <Link className="btn" href="/dashboard/updates">
                  View Inbox
                </Link>
              </div>
            </article>
          </div>
        </div>

        <DashboardOverview />
      </section>
    </>
  );
}
