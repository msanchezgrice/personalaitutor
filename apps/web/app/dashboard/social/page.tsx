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
      headerSubtitle="Daily first-person LinkedIn + Tweet drafts generated from your active project context."
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
      decor={<div className="absolute top-0 right-1/4 w-[400px] h-[300px] bg-[#0077b5]/10 blur-[120px] pointer-events-none"></div>}
    >
      <div className="p-10 max-w-4xl mx-auto w-full pb-24 space-y-8">
        <section className="glass p-6 md:p-8 rounded-2xl border border-white/10 bg-white/5 runtime-social-shell">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-[Outfit] font-semibold text-slate-900">Social Drafts</h2>
              <p className="text-xs text-slate-600 mt-1">Generating today&apos;s first-person LinkedIn and Tweet drafts.</p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs text-slate-600">
              <span className="runtime-loader-spinner runtime-loader-spinner-sm"></span>
              <span>Building drafts from your active project</span>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[#0a66c2]/30 bg-[#eef5ff] p-4 runtime-social-card runtime-social-card-linkedin">
              <div className="flex items-center justify-between mb-3">
                <div className="h-4 w-24 rounded bg-slate-200 runtime-skeleton"></div>
                <span className="text-[10px] text-slate-500 flex items-center gap-2">
                  <span className="runtime-loader-spinner runtime-loader-spinner-sm"></span>
                  Preparing
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white/90 p-4 min-h-[180px]">
                <div className="space-y-2">
                  <div className="h-3 rounded bg-slate-200 runtime-skeleton"></div>
                  <div className="h-3 rounded bg-slate-200 runtime-skeleton"></div>
                  <div className="h-3 rounded bg-slate-200 runtime-skeleton"></div>
                  <div className="h-3 w-5/6 rounded bg-slate-200 runtime-skeleton"></div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 runtime-social-card runtime-social-card-x">
              <div className="flex items-center justify-between mb-3">
                <div className="h-4 w-20 rounded bg-slate-200 runtime-skeleton"></div>
                <span className="text-[10px] text-slate-500 flex items-center gap-2">
                  <span className="runtime-loader-spinner runtime-loader-spinner-sm"></span>
                  Preparing
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 min-h-[180px]">
                <div className="space-y-2">
                  <div className="h-3 rounded bg-slate-200 runtime-skeleton"></div>
                  <div className="h-3 rounded bg-slate-200 runtime-skeleton"></div>
                  <div className="h-3 rounded bg-slate-200 runtime-skeleton"></div>
                  <div className="h-3 w-4/5 rounded bg-slate-200 runtime-skeleton"></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
