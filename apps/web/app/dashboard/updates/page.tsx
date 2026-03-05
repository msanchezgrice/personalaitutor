import { DashboardShell } from "@/components/dashboard-runtime-shell";

export default function DashboardUpdatesPage() {
  return (
    <DashboardShell
      activeTab="activity"
      headerTitle={(
        <span className="flex items-center gap-3">
          <i className="fa-solid fa-clock-rotate-left text-white"></i> Activity Log
        </span>
      )}
      decor={<div className="absolute top-0 right-1/4 w-[400px] h-[300px] bg-slate-400/10 blur-[120px] pointer-events-none"></div>}
    >
      <div className="p-10 max-w-4xl mx-auto w-full pb-24 space-y-4">
        <section className="glass p-6 rounded-xl border border-slate-300 bg-slate-50 runtime-loading-panel">
          <div className="flex items-center gap-3 text-slate-900 mb-2">
            <span className="runtime-loader-spinner"></span>
            <span className="font-semibold">Loading activity feed</span>
          </div>
          <p className="text-sm text-slate-700">Fetching recent tutor events and your latest daily update.</p>
        </section>
      </div>
    </DashboardShell>
  );
}
