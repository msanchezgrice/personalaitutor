import { SocialDrafts } from "@/components/social-drafts";

export default function DashboardSocialPage() {
  return (
    <>
      <section className="dash-header">
        <div>
          <h1 style={{ fontSize: "2rem" }}>Social Hooks</h1>
          <p>Generate LinkedIn/X posts from project proof and publish via API or native composer.</p>
        </div>
      </section>

      <section className="dash-body">
        <article className="dash-panel">
          <h2>LinkedIn and X publishing</h2>
          <SocialDrafts />
        </article>
      </section>
    </>
  );
}
