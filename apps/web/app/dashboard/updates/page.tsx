import { UpdatesConsole } from "@/components/updates-console";

export default function DashboardUpdatesPage() {
  return (
    <>
      <section className="dash-header">
        <div>
          <h1 style={{ fontSize: "2rem" }}>AI Inbox and News</h1>
          <p>Relevant AI news module plus daily digest and fail-state notifications.</p>
        </div>
      </section>

      <section className="dash-body">
        <article className="dash-panel">
          <h2>Updates and scheduler controls</h2>
          <UpdatesConsole />
        </article>
      </section>
    </>
  );
}
