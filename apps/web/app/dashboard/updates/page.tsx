import { DashboardShell } from "@/components/dashboard-runtime-shell";
import { buildDashboardRuntimeBootstrap, getDashboardServerState } from "@/app/dashboard/_lib";

export default async function DashboardUpdatesPage() {
  const state = await getDashboardServerState();
  const user = state.user;
  return (
    <DashboardShell
      activeTab="activity"
      headerTitle={(
        <span className="flex items-center gap-3">
          <i className="fa-solid fa-clock-rotate-left text-white"></i> Activity Log
        </span>
      )}
      operatorToolsHref={state.operatorToolsUrl}
      billingPortalEnabled={Boolean(state.billing.subscription)}
      runtimeBootstrap={buildDashboardRuntimeBootstrap(state)}
      initialUser={{
        name: user?.name ?? state.seed?.name ?? "Learner",
        headline: user?.headline ?? "AI Builder",
        avatarUrl: user?.avatarUrl ?? state.seed?.avatarUrl ?? null,
        publicProfileUrl: state.publicProfileUrl,
        levelLabel: state.sidebarLevel.label,
        levelSubtitle: state.sidebarLevel.subtitle,
        levelProgressPct: state.sidebarLevel.progressPct,
        levelProgressText: state.sidebarLevel.progressText,
      }}
      decor={<div className="absolute top-0 right-1/4 w-[400px] h-[300px] bg-slate-400/10 blur-[120px] pointer-events-none"></div>}
    >
      <div className="p-10 max-w-4xl mx-auto w-full pb-24 space-y-4">
        <section className="glass p-6 rounded-xl border border-slate-300 bg-slate-50 runtime-loading-panel">
          <div className="flex items-center gap-3 text-slate-900 mb-2">
            <span className="runtime-loader-spinner"></span>
            <span className="font-semibold">Loading activity feed</span>
          </div>
          <p className="text-sm text-slate-700">Showing recent user actions like sign-up, starting packs, and generated outputs.</p>
        </section>
      </div>
    </DashboardShell>
  );
}
