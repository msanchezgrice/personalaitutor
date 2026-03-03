import { ProjectChat } from "@/components/project-chat";

export default function DashboardChatPage() {
  return (
    <>
      <section className="dash-header">
        <div>
          <h1 style={{ fontSize: "2rem" }}>AI Tutor Session</h1>
          <p>Project chat + event streams with explicit disconnect recovery.</p>
        </div>
      </section>

      <section className="dash-body">
        <article className="dash-panel">
          <h2>AI Tutor Chat</h2>
          <ProjectChat />
        </article>
      </section>
    </>
  );
}
