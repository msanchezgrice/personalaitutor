import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard-runtime-shell";
import { FbCompleteRegistrationOnDashboard } from "@/components/fb-complete-registration-on-dashboard";

export default function DashboardPage() {
  return (
    <>
      <Suspense fallback={null}>
        <FbCompleteRegistrationOnDashboard />
      </Suspense>
      <DashboardShell
        activeTab="home"
        headerTitle={<span data-dashboard-greeting="1">Loading your dashboard...</span>}
        headerSubtitle="Preparing your tutor workspace."
      >
        <div className="p-10 max-w-6xl mx-auto w-full pb-24">
          <div className="glass-panel p-6 rounded-2xl mb-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-emerald-500/30 overflow-hidden relative">
            <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none"></div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-full border-2 border-emerald-500 p-1">
                <div className="w-full h-full bg-emerald-500 rounded-full flex items-center justify-center">
                  <i className="fa-solid fa-robot text-white text-xl"></i>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-white mb-1">
                  <span className="text-emerald-400">Today&apos;s update:</span> Loading your tutor summary...
                </h3>
                <p className="text-sm text-gray-400">Continue where we left off: Loading your latest project context.</p>
              </div>
            </div>
            <a href="/dashboard/chat/" className="btn btn-primary whitespace-nowrap relative z-10">
              Continue where we left off
            </a>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <section>
                <div className="flex justify-between items-end mb-4">
                  <h2 className="text-lg font-[Outfit] font-medium text-white flex items-center gap-2">
                    <i className="fa-solid fa-folder-open text-amber-400"></i> Active Projects
                  </h2>
                  <a href="/dashboard/projects/" className="text-xs text-emerald-400 hover:text-emerald-300">
                    View All
                  </a>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <a
                    href="/dashboard/projects/"
                    className="glass p-5 rounded-xl hover:bg-white/5 border border-white/10 hover:border-emerald-500/40 transition group cursor-pointer block"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-lg">
                        <i className="fa-solid fa-layer-group"></i>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-500 px-2 py-1 rounded">
                        Loading
                      </span>
                    </div>
                    <h3 className="font-medium text-white mb-1 group-hover:text-emerald-400 transition-colors">
                      Loading active project...
                    </h3>
                    <p className="text-xs text-gray-400 mb-4 line-clamp-2">Fetching your first active module or project.</p>
                    <div className="w-full bg-black/40 h-1.5 rounded-full">
                      <div className="bg-emerald-500 w-[20%] h-full rounded-full"></div>
                    </div>
                  </a>
                  <a
                    href="/dashboard/projects/"
                    className="glass p-5 rounded-xl hover:bg-white/5 border border-emerald-500/30 bg-emerald-500/5 transition group cursor-pointer block relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div className="w-10 h-10 rounded bg-teal-500/20 text-teal-400 flex items-center justify-center text-lg">
                        <i className="fa-solid fa-award"></i>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded">
                        Syncing
                      </span>
                    </div>
                    <h3 className="font-medium text-white mb-1 relative z-10">Latest proof artifact</h3>
                    <p className="text-xs text-gray-400 mb-4 line-clamp-2 relative z-10">
                      Completed work appears here after the dashboard sync finishes.
                    </p>
                    <div className="text-xs text-emerald-400 flex items-center gap-1 font-medium mt-auto relative z-10">
                      <i className="fa-solid fa-award"></i> Proof syncing
                    </div>
                  </a>
                </div>
              </section>

              <section>
                <h2 className="text-lg font-[Outfit] font-medium text-white mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-layer-group text-teal-400"></i> Verified Skill Stack
                </h2>
                <div className="glass p-6 rounded-xl flex flex-wrap gap-2">
                  <div className="flex border border-emerald-500/30 bg-emerald-500/10 rounded-full items-center px-3 py-1.5">
                    <span className="text-xs font-medium text-emerald-400">Loading verified skills...</span>
                  </div>
                  <div className="flex border border-white/10 bg-white/5 rounded-full items-center px-3 py-1.5">
                    <span className="text-xs text-gray-300">Skills sync after hydration</span>
                  </div>
                  <div className="flex border border-white/5 border-dashed bg-transparent rounded-full items-center px-3 py-1.5">
                    <span className="text-xs text-gray-500">
                      <i className="fa-solid fa-plus mr-1"></i> Add Target Skill
                    </span>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-8">
              <section>
                <div className="flex justify-between items-end mb-4">
                  <h2 className="text-lg font-[Outfit] font-medium text-white flex items-center gap-2">
                    <i className="fa-brands fa-linkedin text-[#0077b5]"></i> Social Drafts
                  </h2>
                </div>
                <div className="glass border border-[#0077b5]/30 bg-gradient-to-b from-[#0077b5]/10 to-transparent p-5 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="runtime-loader-spinner runtime-loader-spinner-sm"></span>
                    <span className="text-xs font-medium text-[#0077b5] uppercase tracking-wider">Preparing today&apos;s draft</span>
                  </div>
                  <p className="text-sm text-gray-300 mb-4 italic border-l-2 border-[#0077b5] pl-3 py-1 bg-black/20 rounded-r">
                    &quot;Generating today&apos;s first-person social draft from your current project context.&quot;
                  </p>
                  <a href="/dashboard/social/" className="btn bg-[#0077b5] hover:bg-[#005582] text-white w-full py-2 text-sm">
                    Open Social Drafts
                  </a>
                </div>
              </section>

              <section data-home-ai-news="1">
                <div className="flex justify-between items-end mb-4">
                  <h2 className="text-lg font-[Outfit] font-medium text-white flex items-center gap-2">
                    <i className="fa-solid fa-newspaper text-sky-400"></i> AI News
                  </h2>
                  <a href="/dashboard/ai-news/" className="text-xs text-sky-300 hover:text-sky-200">
                    View all
                  </a>
                </div>
                <div className="space-y-3">
                  <a
                    href="/dashboard/ai-news/"
                    className="block glass p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 hover:bg-white/5 transition flex gap-3"
                  >
                    <div className="w-8 h-8 rounded shrink-0 bg-sky-500/20 flex items-center justify-center text-sky-400">
                      <span className="runtime-loader-spinner runtime-loader-spinner-sm"></span>
                    </div>
                    <div>
                      <h4 className="font-medium text-white text-sm mb-0.5">Preparing AI News</h4>
                      <p className="text-xs text-gray-400 line-clamp-2">Fetching and caching today&apos;s personalized AI stories for this session.</p>
                    </div>
                  </a>
                  <a
                    href="/dashboard/ai-news/"
                    className="block glass p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 hover:bg-white/5 transition flex gap-3"
                  >
                    <div className="w-8 h-8 rounded shrink-0 bg-sky-500/20 flex items-center justify-center text-sky-400">
                      <i className="fa-solid fa-wave-square text-xs"></i>
                    </div>
                    <div>
                      <h4 className="font-medium text-white text-sm mb-0.5">Session cache warming</h4>
                      <p className="text-xs text-gray-400 line-clamp-2">The feed is prepared in the background so the AI News tab opens warm.</p>
                    </div>
                  </a>
                </div>
              </section>
            </div>
          </div>
        </div>
      </DashboardShell>
    </>
  );
}
