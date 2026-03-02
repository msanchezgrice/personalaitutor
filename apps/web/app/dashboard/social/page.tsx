import { TopNav } from "@/components/nav";
import { SocialDrafts } from "@/components/social-drafts";

export default function DashboardSocialPage() {
  return (
    <>
      <TopNav />
      <main className="container section">
        <h1>LinkedIn and X Social Publishing</h1>
        <p className="lead">Create proposed posts from your activity, include OG links, and publish by API or native composer.</p>
        <SocialDrafts />
      </main>
    </>
  );
}
