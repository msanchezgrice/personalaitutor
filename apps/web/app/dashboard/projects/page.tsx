import { DashboardShell } from "@/components/dashboard-runtime-shell";
import { DashboardProjectWorkbench } from "@/components/dashboard-project-workbench";
import { getDashboardServerState } from "@/app/dashboard/_lib";
import { buildRecommendedModuleGuide, getCareerPath } from "@aitutor/shared";

function summarize(value: string | null | undefined, fallback: string, maxChars = 160) {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim();
  const base = cleaned || fallback;
  if (base.length <= maxChars) return base;
  return `${base.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}

export default async function DashboardProjectsPage() {
  const state = await getDashboardServerState();
  const user = state.user;
  const summary = state.summary;
  const activeProject = state.activeProject;
  const completedProject = state.completedProject;
  const primaryCareerPath = getCareerPath(user?.careerPathId ?? summary?.gamification.primaryTrackId ?? "");
  const recommendedModuleTitle = summary?.moduleRecommendations?.[0]?.title ?? primaryCareerPath?.modules[0] ?? "Starter AI Pack";
  const guide = buildRecommendedModuleGuide({
    careerPathId: user?.careerPathId ?? summary?.gamification.primaryTrackId ?? null,
    moduleTitle: recommendedModuleTitle,
    jobTitle: user?.headline ?? null,
    primaryGoal: user?.goals?.[0] ?? null,
  });
  return (
    <DashboardShell
      activeTab="projects"
      headerTitle={(
        <span className="flex items-center gap-3">
          <i className="fa-solid fa-folder-open text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]"></i>
          Project Portfolio
        </span>
      )}
      headerSubtitle="Manage your active builds and public proof artifacts."
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
      decor={<div className="absolute top-0 right-1/4 w-[500px] h-[300px] bg-amber-500/10 blur-[120px] pointer-events-none"></div>}
      hideHeaderActionsOnMobile
      headerActions={(
        <a
          href="/dashboard/chat/"
          className="btn btn-primary text-xs px-4 py-2 shadow-[0_4px_10px_0_var(--primary-glow)]"
          data-analytics-event="projects_cta_clicked"
          data-analytics-cta="start_new_project"
          data-analytics-location="header"
          data-analytics-destination="/dashboard/chat/"
        >
          <i className="fa-solid fa-plus mr-1"></i> Start New Project
        </a>
      )}
    >
      <div className="p-10 max-w-6xl mx-auto w-full pb-24 space-y-12">
        <div className="lg:hidden">
          <a
            href="/dashboard/chat/"
            className="btn btn-primary w-full justify-center text-sm px-4 py-3 shadow-[0_4px_10px_0_var(--primary-glow)]"
            data-analytics-event="projects_cta_clicked"
            data-analytics-cta="start_new_project"
            data-analytics-location="mobile_header"
            data-analytics-destination="/dashboard/chat/"
          >
            <i className="fa-solid fa-plus mr-2"></i> Start New Project
          </a>
        </div>
        <section>
          <h2 className="text-lg font-[Outfit] font-medium text-white mb-6 uppercase tracking-wider text-sm text-gray-400 border-b border-white/10 pb-2">
            Active Builds
          </h2>
          <a
            href="#pack-workbench"
            className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-amber-500/30 overflow-hidden relative cursor-pointer hover:bg-white/5 transition"
            data-analytics-event="projects_cta_clicked"
            data-analytics-cta="open_module_workbench"
            data-analytics-location="active_build"
            data-analytics-destination="#pack-workbench"
          >
            <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-amber-500/5 to-transparent pointer-events-none"></div>
            <div className="flex items-start gap-4 md:gap-6 relative z-10 w-full">
              <div className="w-16 h-16 rounded-xl border border-amber-500/50 p-1 flex-shrink-0 bg-black/40 shadow-[0_0_15px_rgba(251,191,36,0.2)] flex items-center justify-center">
                <i className="fa-solid fa-layer-group text-3xl text-amber-400"></i>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center mb-1">
                  <h3 className="text-xl font-medium text-white">{activeProject?.title || guide.moduleTitle}</h3>
                  <span className="text-[10px] bg-amber-500/20 text-amber-500 font-bold uppercase px-2 py-0.5 rounded border border-amber-500/30">
                    {activeProject ? "Active" : "Planned"}
                  </span>
                </div>
                <p className="text-sm text-gray-400 max-w-xl">
                  {summarize(activeProject?.description, guide.whyThisModule)}
                </p>
                <div className="mt-4 md:hidden">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-amber-400 mb-2">
                    <span>Progress</span>
                    <span>{activeProject ? "20%" : "10%"}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                      style={{ width: activeProject ? "20%" : "10%" }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative w-16 h-16 md:mr-4 flex-shrink-0 items-center justify-center self-center md:self-auto hidden md:flex">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                <circle cx="18" cy="18" r="16" fill="none" className="stroke-current text-white/10" strokeWidth="2"></circle>
                <circle cx="18" cy="18" r="16" fill="none" className="stroke-current text-amber-400" strokeWidth="2" strokeDasharray="100" strokeDashoffset="80"></circle>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-amber-400">
                {activeProject ? "20%" : "10%"}
              </div>
            </div>
          </a>
        </section>

        <DashboardProjectWorkbench
          guide={guide}
          projectId={activeProject?.id ?? null}
          projectTitle={activeProject?.title || `${guide.careerPathName} Starter Build`}
          projectState={activeProject?.state || "planned"}
          artifactCount={activeProject?.artifacts.length ?? 0}
          recentArtifacts={activeProject?.artifacts ?? []}
          publicProfileUrl={state.publicProfileUrl}
        />

        <section>
          <h2 className="text-lg font-[Outfit] font-medium text-white mb-6 uppercase tracking-wider text-sm text-gray-400 border-b border-white/10 pb-2">
            {completedProject ? "Completed & Published Proof" : "Recommended Packs"}
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass flex flex-col p-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 relative overflow-hidden h-full">
              <div className="absolute -bottom-10 -right-10 opacity-5 pointer-events-none">
                <i className="fa-solid fa-shield-check text-[150px]"></i>
              </div>
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <i className="fa-solid fa-award"></i>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-transparent text-gray-500 border border-white/10 px-2 py-1 rounded">
                    {completedProject ? "Ready" : "Start Here"}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                    {completedProject ? "Published" : "Not Started"}
                  </span>
                </div>
              </div>
              <h3 className="text-lg font-medium text-white mb-2 relative z-10">
                {completedProject?.title || activeProject?.title || "Starter AI Pack"}
              </h3>
              <p className="text-sm text-gray-400 mb-6 flex-grow relative z-10">
                {summarize(
                  completedProject?.description || activeProject?.description,
                  "Start this recommended pack first. Completed projects will appear here after your first shipped outcome.",
                )}
              </p>
              <div className="flex items-center gap-3 mt-auto relative z-10 pt-4 border-t border-white/5">
                {completedProject ? (
                  <>
                    <a
                      href={state.publicProfileUrl || "/dashboard/profile"}
                      className="btn btn-secondary text-xs px-3 py-1.5 flex-1 text-center"
                      data-analytics-event="public_profile_clicked"
                      data-analytics-location="projects_page"
                      data-analytics-destination={state.publicProfileUrl || "/dashboard/profile"}
                    >
                      <i className="fa-solid fa-globe mr-1"></i> View Public Page
                    </a>
                    <button
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 transition"
                      title="Copy Link"
                      data-analytics-event="project_public_link_copy_clicked"
                      data-analytics-location="projects_page"
                    >
                      <i className="fa-solid fa-link"></i>
                    </button>
                  </>
                ) : (
                  <a
                    href="#pack-workbench"
                    className="btn btn-primary text-xs px-3 py-2 flex-1 text-center"
                    data-analytics-event="projects_cta_clicked"
                    data-analytics-cta="start_recommended_pack"
                    data-analytics-location="recommended_pack_card"
                    data-analytics-destination="#pack-workbench"
                  >
                    <i className="fa-solid fa-play mr-1"></i> Click to Start
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
