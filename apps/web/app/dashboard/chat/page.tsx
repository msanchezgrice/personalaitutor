import { TopNav } from "@/components/nav";
import { ProjectChat } from "@/components/project-chat";

export default function DashboardChatPage() {
  return (
    <>
      <TopNav />
      <main className="container section">
        <h1>AI Tutor Chat</h1>
        <p className="lead">Project chat and live job event stream through `/api/projects/:id/events`.</p>
        <ProjectChat />
      </main>
    </>
  );
}
