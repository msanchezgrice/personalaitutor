import Link from "next/link";
import { CAREER_PATHS } from "@aitutor/shared";
import { TopNav } from "@/components/nav";

export default function HomePage() {
  return (
    <>
      <TopNav />
      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <span className="tag">AI is moving fast</span>
              <h1>
                Meet your dedicated AI Tutor that teaches and proves your skills.
              </h1>
              <p className="lead">
                System-Verified Proof of Work for the AI era. Build projects, complete modules, earn verified skill
                badges, and publish an employer-ready public profile.
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
                <a className="btn primary" href="https://careerguard.me/intake" target="_blank" rel="noreferrer">
                  Start AI Assessment
                </a>
                <Link className="btn" href="/onboarding">
                  Start Onboarding Wizard
                </Link>
                <Link className="btn" href="/employers/talent">
                  See Talent Board
                </Link>
              </div>

              <div className="stats">
                <div className="stat">
                  <strong>Website</strong>
                  Your public profile and project pages.
                </div>
                <div className="stat">
                  <strong>Build Log</strong>
                  Event-level proof mapped to skills.
                </div>
                <div className="stat">
                  <strong>Verification</strong>
                  Platform Verified and AI Tutor Verified badges.
                </div>
              </div>
            </div>

            <div className="hero-frame glass-panel">
              <div className="overlay" />
              <iframe src="/dashboard/" title="Dashboard preview" />
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container panel">
            <h2>How It Works</h2>
            <ol className="list">
              <li>Tell us your background and goals.</li>
              <li>Your AI Tutor builds a personalized dashboard and starts execution jobs.</li>
              <li>Complete modules and explainers to earn badges and verified skills.</li>
              <li>Your AI Tutor remains available to explain, build, and troubleshoot.</li>
              <li>Receive goal-aligned daily updates with status, tasks, and relevant AI news.</li>
            </ol>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <h2>Career paths and module matrix</h2>
            <p className="lead">Onboarding, dashboard checklists, and employer filters share the same matrix source.</p>
            <div className="grid-4" style={{ marginTop: 14 }}>
              {CAREER_PATHS.map((path) => (
                <article key={path.id} className="card">
                  <h3>{path.name}</h3>
                  <p className="lead" style={{ marginTop: 6 }}>{path.coreSkillDomain}</p>
                  <ul className="list">
                    {path.modules.slice(0, 2).map((module) => (
                      <li key={module}>{module}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container panel">
            <h2>This is your secret weapon for staying up to date</h2>
            <p className="lead">
              AI will not replace you. Someone with AI skills will. We help you build those skills and prove them
              publicly.
            </p>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="btn primary" href="/dashboard">
                Open Dashboard
              </Link>
              <Link className="btn" href="/u/test-user-0001">
                See Public Profile Example
              </Link>
              <Link className="btn" href="/employers">
                Employer Portal
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="container footer">No silent fallback behavior in MVP. Fail states always include recovery actions.</footer>
    </>
  );
}
