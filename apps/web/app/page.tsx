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
              <span className="tag">Your dedicated AI copilot for career growth</span>
              <h1 className="hero-main-title">
                Learn fast and <span className="text-gradient">prove it publicly.</span>
              </h1>
              <p className="lead" style={{ fontSize: "1.22rem" }}>
                AI is moving fast. Meet your dedicated AI Tutor that teaches you how to build with AI and generates
                System-Verified Proof of Work across projects, modules, and artifacts.
              </p>

              <div className="hero-actions">
                <a className="btn primary" href="https://careerguard.me/intake" target="_blank" rel="noreferrer">
                  Take the AI Assessment
                </a>
                <Link className="btn" href="/employers/talent">
                  See Example Profiles
                </Link>
              </div>

              <div className="hero-foot">
                <div className="avatar-stack">
                  <span>AC</span>
                  <span>+2k</span>
                </div>
                <p>Professionals already building their AI stack.</p>
              </div>
            </div>

            <div className="hero-frame">
              <div className="overlay" />
              <iframe src="/dashboard/" title="Dashboard preview" />
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container panel pad">
            <h2>How it works</h2>
            <ol className="list">
              <li>Tell us your background and goals.</li>
              <li>Your dedicated AI Tutor builds a custom dashboard and starts guided execution.</li>
              <li>Complete modules and explainers to earn badges and skill status updates.</li>
              <li>Your tutor stays available to explain and build with you 24/7.</li>
              <li>Receive daily updates with status, upcoming tasks, relevant AI news, and links.</li>
            </ol>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <h2>What gets built for you</h2>
            <p className="lead">Website, build log, profile, project cards, social drafts, and production artifacts.</p>
            <div className="grid-3" style={{ marginTop: 14 }}>
              <article className="card">
                <h3>Public profile website</h3>
                <p>SEO-ready profile page with social links, token usage, and proof-based skills.</p>
              </article>
              <article className="card">
                <h3>Build log + project cards</h3>
                <p>Upwork-style stack details backed by build telemetry and verification events.</p>
              </article>
              <article className="card">
                <h3>Artifact generation</h3>
                <p>One-click website, pptx, pdf, resume_docx, and resume_pdf generation per project.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container panel pad">
            <h2>Career Matrix</h2>
            <p className="lead">Onboarding options, dashboard skill lists, and talent marketplace filters come from one matrix source.</p>
            <div className="grid-4" style={{ marginTop: 12 }}>
              {CAREER_PATHS.map((path) => (
                <article key={path.id} className="card">
                  <strong>{path.name}</strong>
                  <p>{path.coreSkillDomain}</p>
                </article>
              ))}
            </div>

            <div className="cta-band">
              <h3>This is your secret weapon for staying up to date.</h3>
              <p className="lead">
                AI won&apos;t replace you. Someone with AI skills will. Start building public proof now.
              </p>
              <div className="hero-actions">
                <Link className="btn primary" href="/onboarding">
                  Start Building
                </Link>
                <Link className="btn" href="/employers/talent">
                  Explore Talent Board
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="container footer">No silent fallback behavior. Every fail-state includes recovery actions.</footer>
    </>
  );
}
