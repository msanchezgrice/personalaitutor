import { ProfileEditor } from "@/components/profile-editor";

export default function DashboardProfilePage() {
  return (
    <>
      <section className="dash-header">
        <div>
          <h1 style={{ fontSize: "2rem" }}>Profile Settings</h1>
          <p>Publish your profile, projects, build log, and SEO metadata in one workflow.</p>
        </div>
      </section>

      <section className="dash-body">
        <article className="dash-panel">
          <h2>My Online Profile</h2>
          <ProfileEditor />
        </article>
      </section>
    </>
  );
}
