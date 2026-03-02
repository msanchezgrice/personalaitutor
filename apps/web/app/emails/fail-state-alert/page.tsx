export default function FailStateEmailPreviewPage() {
  return (
    <main className="container section">
      <h1>Fail-State Alert Email Preview</h1>
      <p className="lead">Template sent when job or provider failures block progress.</p>
      <section className="panel" style={{ marginTop: 14 }}>
        <p><strong>Subject:</strong> Action Required: AI Tutor task failed</p>
        <hr style={{ borderColor: "var(--border-color)", margin: "12px 0" }} />
        <p>Hello TEST_USER_0001,</p>
        <p>One of your AI Tutor tasks failed and cannot continue automatically.</p>
        <p><strong>Failure code:</strong> OAUTH_NOT_CONNECTED</p>
        <p><strong>Affected action:</strong> Social publish (LinkedIn API mode)</p>
        <p><strong>Recovery action:</strong> Reconnect LinkedIn OAuth and retry from dashboard social tab.</p>
        <p>Recovery link: <a href="http://localhost:6396/dashboard/social">http://localhost:6396/dashboard/social</a></p>
      </section>
    </main>
  );
}
