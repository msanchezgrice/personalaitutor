import { DashboardShell } from "@/components/dashboard-runtime-shell";

export default function DashboardAiNewsPage() {
  return (
    <DashboardShell
      activeTab="ai-news"
      headerTitle={(
        <span className="flex items-center gap-3">
          <i className="fa-solid fa-newspaper text-sky-400"></i> AI News
        </span>
      )}
      decor={<div className="absolute top-0 right-1/4 w-[400px] h-[300px] bg-sky-500/10 blur-[120px] pointer-events-none"></div>}
    >
      <div className="p-10 max-w-4xl mx-auto w-full pb-24 space-y-4">
        <section className="glass p-6 rounded-xl border border-sky-300 bg-sky-50 runtime-loading-panel">
          <div className="flex items-center gap-3 text-sky-900 mb-2">
            <span className="runtime-loader-spinner"></span>
            <span className="font-semibold">Preparing today&apos;s AI news briefing</span>
          </div>
          <p className="text-sm text-slate-700">Fetching and caching personalized stories for this session.</p>
        </section>
      </div>
    </DashboardShell>
  );
}
