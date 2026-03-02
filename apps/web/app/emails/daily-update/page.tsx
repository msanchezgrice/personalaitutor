export default function DailyUpdateEmailPreviewPage() {
  return (
    <main className="container section">
      <h1>Daily Update Email Preview</h1>
      <p className="lead">Template for learner daily update emails.</p>
      <section className="panel" style={{ marginTop: 14 }}>
        <p><strong>Subject:</strong> Daily AI Tutor Update: Progress, next tasks, and AI news</p>
        <hr style={{ borderColor: "var(--border-color)", margin: "12px 0" }} />
        <p>Hello TEST_USER_0001,</p>
        <p>Today’s status:</p>
        <ul className="list">
          <li>1 project advanced to built state.</li>
          <li>2 modules in progress.</li>
          <li>1 social draft generated.</li>
        </ul>
        <p>Upcoming tasks:</p>
        <ul className="list">
          <li>Complete module checkpoint.</li>
          <li>Generate one resume artifact.</li>
          <li>Publish one LinkedIn post draft.</li>
        </ul>
        <p>Relevant AI news:</p>
        <ul className="list">
          <li>Eval tooling update for production copilots.</li>
          <li>Agentic GTM workflows for RevOps.</li>
          <li>RAG quality gates for support automation.</li>
        </ul>
        <p>Open dashboard: <a href="http://localhost:6396/dashboard">http://localhost:6396/dashboard</a></p>
      </section>
    </main>
  );
}
