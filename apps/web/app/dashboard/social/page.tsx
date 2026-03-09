import { DashboardShell } from "@/components/dashboard-runtime-shell";
import { getDashboardServerState } from "@/app/dashboard/_lib";

export default async function DashboardSocialPage() {
  const state = await getDashboardServerState();
  const user = state.user;
  return (
    <DashboardShell
      activeTab="social"
      headerTitle={(
        <span className="flex items-center gap-3">
          <i className="fa-solid fa-share-nodes text-[#0077b5]"></i> Social Drafts
        </span>
      )}
      headerSubtitle="Draft first-person LinkedIn and X posts from your active project work."
      operatorToolsHref={state.operatorToolsUrl}
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
      decor={<div className="absolute top-0 right-1/4 w-[420px] h-[320px] bg-[#0077b5]/10 blur-[120px] pointer-events-none"></div>}
    >
      <div className="p-10 max-w-4xl mx-auto w-full pb-24 space-y-8">
        <section className="glass p-6 rounded-xl border border-[#0077b5]/30 bg-[#eef5ff] runtime-loading-panel">
          <div className="flex items-center gap-3 text-[#0a66c2] mb-2">
            <span className="runtime-loader-spinner"></span>
            <span className="font-semibold">Preparing today&apos;s social drafts</span>
          </div>
          <p className="text-sm text-slate-700">
            We&apos;re building first-person LinkedIn and X drafts from your latest work.
          </p>
        </section>
      </div>
    </DashboardShell>
  );
}
