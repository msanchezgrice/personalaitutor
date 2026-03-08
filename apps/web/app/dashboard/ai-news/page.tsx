import { DashboardShell } from "@/components/dashboard-runtime-shell";
import { getDashboardServerState } from "@/app/dashboard/_lib";

export default async function DashboardAiNewsPage() {
  const state = await getDashboardServerState();
  const user = state.user;
  return (
    <DashboardShell
      activeTab="ai-news"
      headerTitle={(
        <span className="flex items-center gap-3">
          <i className="fa-solid fa-newspaper text-sky-400"></i> AI News
        </span>
      )}
      operatorToolsHref={state.operatorToolsUrl}
      initialUser={{
        name: user?.name ?? state.seed?.name ?? "Learner",
        headline: user?.headline ?? "AI Builder",
        avatarUrl: user?.avatarUrl ?? state.seed?.avatarUrl ?? null,
        publicProfileUrl: state.publicProfileUrl,
        levelLabel: "Level 1",
        levelSubtitle: "Starter Builder",
        levelProgressPct: 20,
        levelProgressText: "Start building to level up",
      }}
      decor={<div className="absolute top-0 right-1/4 w-[400px] h-[300px] bg-sky-500/10 blur-[120px] pointer-events-none"></div>}
    >
      <div className="p-10 max-w-4xl mx-auto w-full pb-24 space-y-4">
        <section className="glass p-6 rounded-xl border border-sky-300 bg-sky-50 runtime-loading-panel">
          <div className="flex items-center gap-3 text-sky-900 mb-4">
            <span className="runtime-loader-spinner"></span>
            <span className="font-semibold">Preparing today&apos;s AI news briefing</span>
          </div>
          <p className="text-sm text-slate-700 mb-4">Fetching and caching personalized stories for this session.</p>
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-sky-200 bg-white/90 p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="h-3 w-20 rounded bg-sky-100 runtime-skeleton"></div>
                  <div className="h-3 w-16 rounded bg-sky-100 runtime-skeleton"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-5/6 rounded bg-sky-100 runtime-skeleton"></div>
                  <div className="h-3 rounded bg-sky-100 runtime-skeleton"></div>
                  <div className="h-3 w-4/5 rounded bg-sky-100 runtime-skeleton"></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
