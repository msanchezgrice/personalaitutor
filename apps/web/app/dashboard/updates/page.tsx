import { TopNav } from "@/components/nav";
import { UpdatesConsole } from "@/components/updates-console";

export default function DashboardUpdatesPage() {
  return (
    <>
      <TopNav />
      <main className="container section">
        <h1>Daily Updates and Relevant AI News</h1>
        <p className="lead">Scheduler hooks for `news-refresh` and `daily-update` with explicit fail-state notices.</p>
        <UpdatesConsole />
      </main>
    </>
  );
}
