import { ProjectWorkbench } from "@/components/project-workbench";

export default function DashboardProjectsPage() {
  return (
    <>
      <section className="dash-header">
        <div>
          <h1 style={{ fontSize: "2rem" }}>Project Portfolio</h1>
          <p>Manage active builds and proof artifacts.</p>
        </div>
      </section>

      <section className="dash-body">
        <article className="dash-panel">
          <h2>Active and Completed Builds</h2>
          <p className="lead">Generate website, deck, PDF, and resume assets directly from project state.</p>
          <ProjectWorkbench />
        </article>

        <div className="fail-box">
          <strong>Fail state policy:</strong> generation failures block promotion to Built/Verified until successful
          retry and evidence sync.
        </div>
      </section>
    </>
  );
}
