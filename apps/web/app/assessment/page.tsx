import { TopNav } from "@/components/nav";
import { AssessmentQuiz } from "@/components/assessment-quiz";

export default function AssessmentPage() {
  return (
    <>
      <TopNav />
      <main className="section">
        <div className="container" style={{ maxWidth: 980 }}>
          <section className="panel pad">
            <h1 style={{ fontSize: "3rem" }}>Let&apos;s find your baseline</h1>
            <p className="lead">Answer a short quiz so your AI Tutor can map a personalized curriculum and skill plan.</p>
            <div className="hero-actions">
              <a className="btn primary" href="https://careerguard.me/intake" target="_blank" rel="noreferrer">
                Open External Intake
              </a>
              <a className="btn" href="/onboarding">
                Back to Onboarding
              </a>
            </div>
          </section>

          <section className="panel pad" style={{ marginTop: 14 }}>
            <AssessmentQuiz />
          </section>

          <section className="panel pad" style={{ marginTop: 14 }}>
            <h3>Hard fail-state examples</h3>
            <div className="grid-2" style={{ marginTop: 10 }}>
              <div className="fail-box">OAuth scope missing blocks career import until reconnect succeeds.</div>
              <div className="fail-box">Assessment submit rejects malformed answers with explicit issue details.</div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
