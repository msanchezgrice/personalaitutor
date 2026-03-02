import { TopNav } from "@/components/nav";
import { ProfileEditor } from "@/components/profile-editor";

export default function DashboardProfilePage() {
  return (
    <>
      <TopNav />
      <main className="container section">
        <h1>My Online Profile</h1>
        <p className="lead">Edit profile metadata, publish public page, and verify OG surfaces for SEO/social sharing.</p>
        <ProfileEditor />
      </main>
    </>
  );
}
