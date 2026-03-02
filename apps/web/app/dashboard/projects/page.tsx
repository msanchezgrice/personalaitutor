import { TopNav } from "@/components/nav";
import { ProjectWorkbench } from "@/components/project-workbench";

export default function DashboardProjectsPage() {
  return (
    <>
      <TopNav />
      <main className="container section">
        <h1>My Projects</h1>
        <p className="lead">Create projects and generate website/PPT/PDF/resume artifacts with explicit failure handling.</p>
        <ProjectWorkbench />
        <div className="fail-box" style={{ marginTop: 14 }}>
          Fail state policy: generation failures block promotion to Built/Verified until successful retry.
        </div>
      </main>
    </>
  );
}
