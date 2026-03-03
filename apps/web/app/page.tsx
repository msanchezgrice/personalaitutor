import Link from "next/link";
import { TopNav } from "@/components/nav";

export default function HomePage() {
  return (
    <>
      <TopNav />
      <main>
        <section className="hero" style={{ paddingTop: 84, paddingBottom: 96 }}>
          <div className="container hero-grid" style={{ alignItems: "center" }}>
            <div>
              <span className="tag" style={{ fontSize: ".95rem", padding: "10px 14px" }}>
                Your dedicated AI copilot for career growth
              </span>
              <h1 className="hero-main-title" style={{ marginTop: 20 }}>
                Learn fast and <span className="text-gradient">prove it publicly.</span>
              </h1>
              <p className="lead" style={{ fontSize: "1.18rem", marginTop: 18 }}>
                AI will not replace you. Someone with AI skills will. We help you build workflows, verify your skills,
                and generate a dynamic public profile.
              </p>

              <div className="hero-actions" style={{ marginTop: 22 }}>
                <Link href="/assessment" className="btn primary" style={{ fontSize: "1.08rem", padding: "14px 26px" }}>
                  Take the AI Assessment
                </Link>
                <Link href="/employers/talent" className="btn" style={{ fontSize: "1.08rem", padding: "14px 26px" }}>
                  See Example Profiles
                </Link>
              </div>

              <div className="hero-foot" style={{ marginTop: 26 }}>
                <div className="avatar-stack">
                  <span style={{ backgroundImage: "url('/assets/avatar.png')", backgroundSize: "cover" }} />
                  <span>+2k</span>
                </div>
                <p>Professionals already building their AI stack.</p>
              </div>
            </div>

            <div className="hero-frame" style={{ transform: "perspective(1200px) rotateY(-5deg) rotateX(5deg)" }}>
              <img
                src="/assets/interface_macro_mockup.png"
                alt="AI Tutor"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          </div>
        </section>

        <section className="section" style={{ borderTop: "1px solid var(--line)", background: "rgba(0,0,0,.2)" }}>
          <div className="container">
            <h2 style={{ textAlign: "center" }}>How it works</h2>
            <p className="lead" style={{ textAlign: "center", margin: "10px auto 0" }}>
              Your AI Tutor guides you from beginner to verified builder through project execution.
            </p>
            <div className="grid-3" style={{ marginTop: 20 }}>
              <article className="card">
                <h3>1. Tell us your background</h3>
                <p>We assess your level and build a custom learning path based on your role and goals.</p>
              </article>
              <article className="card">
                <h3>2. Build real projects</h3>
                <p>Your AI Tutor helps you ship workflows and applications that solve real problems.</p>
              </article>
              <article className="card">
                <h3>3. Earn public proof</h3>
                <p>Automatically generate portfolio pages, build logs, and skill proof for employers.</p>
              </article>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
