import { TopNav } from "@/components/nav";
import { AssessmentQuiz } from "@/components/assessment-quiz";

export default function AssessmentPage() {
  return (
    <>
      <TopNav />
      <main className="container section">
        <h1>AI Assessment</h1>
        <p className="lead">Baseline quiz used by onboarding to personalize modules and verification pathways.</p>

        <div className="panel" style={{ marginTop: 16 }}>
          <h3>CareerGuard intake link</h3>
          <p className="lead">
            External flow requested for onboarding: <a href="https://careerguard.me/intake" target="_blank" rel="noreferrer">https://careerguard.me/intake</a>
          </p>
          <a className="btn primary" href="https://careerguard.me/intake" target="_blank" rel="noreferrer">Open External Intake</a>
        </div>

        <AssessmentQuiz />

        <section className="panel" style={{ marginTop: 16 }}>
          <h3>Hard fail-state examples</h3>
          <div className="grid-2" style={{ marginTop: 10 }}>
            <div className="fail-box">OAuth scope missing blocks career import continuation until reconnect succeeds.</div>
            <div className="fail-box">Assessment submit rejects malformed answers with explicit issue details.</div>
          </div>
        </section>
      </main>
    </>
  );
}
