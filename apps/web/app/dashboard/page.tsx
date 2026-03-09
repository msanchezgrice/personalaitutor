import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard-runtime-shell";
import { FbCompleteRegistrationOnDashboard } from "@/components/fb-complete-registration-on-dashboard";
import { getDashboardServerState } from "@/app/dashboard/_lib";

function summarize(value: string | null | undefined, fallback: string, maxChars = 180) {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim();
  const base = cleaned || fallback;
  if (base.length <= maxChars) return base;
  return `${base.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}

export default async function DashboardPage() {
  const state = await getDashboardServerState();
  const user = state.user;
  const summary = state.summary;
  const activeProject = state.activeProject;
  const completedProject = state.completedProject;
  const topRecommendation = summary?.moduleRecommendations?.[0] ?? null;
  const hasVerifiedSkills = Boolean(user?.skills?.some((skill) => skill.status === "verified"));
  const activeCard = activeProject || (topRecommendation
    ? {
        title: topRecommendation.title,
        description: topRecommendation.summary,
      }
    : {
        title: "Introduction to LLMs",
        description: "Start this module to build LLM fundamentals and ship your first practical artifact.",
      });
  const latestEventMessage = summary?.latestEvents?.[0]?.message;
  const todayUpdateText = summarize(
    summary?.dailyUpdate?.summary || latestEventMessage,
    "You are set up for focused progress today. Pick one concrete task and ship it.",
  );
  const continuationText = summarize(
    activeProject?.buildLog?.at(-1)?.message,
    "Start with your first recommended pack and ask Chat Tutor for help when you get blocked.",
    200,
  );
  const skills = user?.skills?.length
    ? user.skills.slice(0, 3).map((skill) => ({
        label: skill.skill,
        accent: skill.status === "verified",
        suffix: skill.status === "verified" ? "" : ` (${Math.round((skill.score || 0) * 100)}%)`,
      }))
    : (summary?.moduleRecommendations?.slice(0, 3).map((track, index) => ({
        label: track.title,
        accent: index === 0,
        suffix: index === 0 ? " (Start here)" : " (Next)",
      })) ?? []);
  return (
    <>
      <Suspense fallback={null}>
        <FbCompleteRegistrationOnDashboard />
      </Suspense>
      <DashboardShell
        activeTab="home"
        headerTitle={<span data-dashboard-greeting="1">{state.greeting}</span>}
        headerSubtitle="Welcome to your dashboard. Let's start with one focused win."
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
      >
        <div data-dashboard-home-content="1" className="p-10 max-w-6xl mx-auto w-full pb-24">
          <div
            data-dashboard-home-hero="1"
            className="glass-panel p-6 rounded-2xl mb-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-emerald-500/30 overflow-hidden relative"
          >
            <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none"></div>
            <div data-dashboard-home-hero-copy="1" className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-full border-2 border-emerald-500 p-1">
                <div className="w-full h-full bg-emerald-500 rounded-full flex items-center justify-center">
                  <i className="fa-solid fa-robot text-white text-xl"></i>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-white mb-1">
                  <span className="text-emerald-400">Welcome to your dashboard:</span> {todayUpdateText}
                </h3>
                <p className="text-sm text-gray-400">Based on your answers, here is the best next move: {continuationText}</p>
              </div>
            </div>
            <a
              href="/dashboard/chat/"
              data-dashboard-home-hero-cta="1"
              className="btn btn-primary whitespace-nowrap relative z-10"
              data-analytics-event="dashboard_home_cta_clicked"
              data-analytics-cta="continue_chat"
              data-analytics-location="hero"
              data-analytics-destination="/dashboard/chat/"
            >
              Start Recommended Work
            </a>
          </div>

          <div data-dashboard-home-grid="1" className="grid lg:grid-cols-3 gap-8">
            <div data-dashboard-home-primary="1" className="lg:col-span-2 space-y-8">
              <section data-dashboard-home-section="projects">
                <div className="flex justify-between items-end mb-4">
                  <h2 className="text-lg font-[Outfit] font-medium text-white flex items-center gap-2">
                    <i className="fa-solid fa-folder-open text-amber-400"></i> Active Projects
                  </h2>
                  <a
                    href="/dashboard/projects/"
                    className="text-xs text-emerald-400 hover:text-emerald-300"
                    data-analytics-event="dashboard_home_cta_clicked"
                    data-analytics-cta="view_all_projects"
                    data-analytics-location="projects_header"
                    data-analytics-destination="/dashboard/projects/"
                  >
                    View All
                  </a>
                </div>
                <div data-dashboard-home-card-grid="1" className="grid sm:grid-cols-2 gap-4">
                  <a
                    href="/dashboard/projects/"
                    data-dashboard-home-card="1"
                    className="glass p-5 rounded-xl hover:bg-white/5 border border-white/10 hover:border-emerald-500/40 transition group cursor-pointer block"
                    data-analytics-event="dashboard_home_cta_clicked"
                    data-analytics-cta="open_active_projects"
                    data-analytics-location="projects_card"
                    data-analytics-destination="/dashboard/projects/"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-lg">
                        <i className="fa-solid fa-layer-group"></i>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-500 px-2 py-1 rounded">
                        {activeProject ? "In Progress" : "Planned"}
                      </span>
                    </div>
                    <h3 className="font-medium text-white mb-1 group-hover:text-emerald-400 transition-colors">
                      {activeCard.title}
                    </h3>
                    <p className="text-xs text-gray-400 mb-4 line-clamp-2">
                      {summarize(activeCard.description, "Start this module to build LLM fundamentals and ship your first practical artifact.", 120)}
                    </p>
                    <div className="w-full bg-black/40 h-1.5 rounded-full">
                      <div className="bg-emerald-500 w-[20%] h-full rounded-full"></div>
                    </div>
                  </a>
                  <a
                    href="/dashboard/projects/"
                    data-dashboard-home-card="1"
                    className="glass p-5 rounded-xl hover:bg-white/5 border border-emerald-500/30 bg-emerald-500/5 transition group cursor-pointer block relative overflow-hidden"
                    data-analytics-event="dashboard_home_cta_clicked"
                    data-analytics-cta="open_latest_proof"
                    data-analytics-location="proof_card"
                    data-analytics-destination="/dashboard/projects/"
                  >
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div className="w-10 h-10 rounded bg-teal-500/20 text-teal-400 flex items-center justify-center text-lg">
                        <i className="fa-solid fa-award"></i>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded">
                        {completedProject ? "Completed" : "Syncing"}
                      </span>
                    </div>
                    <h3 className="font-medium text-white mb-1 relative z-10">
                      {completedProject?.title || "Latest proof artifact"}
                    </h3>
                    <p className="text-xs text-gray-400 mb-4 line-clamp-2 relative z-10">
                      {summarize(
                        completedProject?.description,
                        "Completed work appears here after the dashboard sync finishes.",
                        120,
                      )}
                    </p>
                    <div className="text-xs text-emerald-400 flex items-center gap-1 font-medium mt-auto relative z-10">
                      <i className="fa-solid fa-award"></i> {completedProject ? "Proof published" : "Proof syncing"}
                    </div>
                  </a>
                </div>
              </section>

              <section data-dashboard-home-section="skills">
                <h2 className="text-lg font-[Outfit] font-medium text-white mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-layer-group text-teal-400"></i> {hasVerifiedSkills ? "Verified Skill Stack" : "Starter Skill Plan"}
                </h2>
                <div data-dashboard-home-skills="1" className="glass p-6 rounded-xl flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <div
                      key={skill.label}
                      className={
                        skill.accent
                          ? "flex border border-emerald-500/30 bg-emerald-500/10 rounded-full items-center px-3 py-1.5"
                          : "flex border border-white/10 bg-white/5 rounded-full items-center px-3 py-1.5"
                      }
                    >
                      <span className={skill.accent ? "text-xs font-medium text-emerald-400" : "text-xs text-gray-300"}>
                        {skill.label}{skill.suffix}
                      </span>
                    </div>
                  ))}
                  <div className="flex border border-white/5 border-dashed bg-transparent rounded-full items-center px-3 py-1.5">
                    <span className="text-xs text-gray-500">
                      <i className="fa-solid fa-compass mr-1"></i> Keep building to verify your first skill
                    </span>
                  </div>
                </div>
              </section>
            </div>

            <div data-dashboard-home-secondary="1" className="space-y-8">
              <section data-dashboard-home-section="social">
                <div className="flex justify-between items-end mb-4">
                  <h2 className="text-lg font-[Outfit] font-medium text-white flex items-center gap-2">
                    <i className="fa-brands fa-linkedin text-[#0077b5]"></i> Social Drafts
                  </h2>
                </div>
                <div data-dashboard-home-preview-card="social" className="glass border border-[#0077b5]/30 bg-gradient-to-b from-[#0077b5]/10 to-transparent p-5 rounded-xl">
                  <p className="text-xs text-[#c6def7] mb-3">
                    Use this tab to grab ready-to-edit posts that summarize your work in first person.
                  </p>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="runtime-loader-spinner runtime-loader-spinner-sm"></span>
                    <span className="text-xs font-medium text-[#0077b5] uppercase tracking-wider">Today&apos;s draft</span>
                  </div>
                  <p
                    data-dashboard-home-social-quote="1"
                    className="text-sm text-gray-300 mb-4 italic border-l-2 border-[#0077b5] pl-3 py-1 bg-black/20 rounded-r"
                  >
                    &quot;Preparing a first-person draft from your active project context.&quot;
                  </p>
                  <a
                    href="/dashboard/social/"
                    data-dashboard-home-social-cta="1"
                    className="btn bg-[#0077b5] hover:bg-[#005582] text-white w-full py-2 text-sm"
                    data-analytics-event="dashboard_home_cta_clicked"
                    data-analytics-cta="open_social_drafts"
                    data-analytics-location="social_card"
                    data-analytics-destination="/dashboard/social/"
                  >
                    Open Social Drafts
                  </a>
                </div>
              </section>

              <section data-home-ai-news="1" data-dashboard-home-section="news">
                <div className="flex justify-between items-end mb-4">
                  <h2 className="text-lg font-[Outfit] font-medium text-white flex items-center gap-2">
                    <i className="fa-solid fa-newspaper text-sky-400"></i> AI News
                  </h2>
                  <a
                    href="/dashboard/ai-news/"
                    className="text-xs text-sky-300 hover:text-sky-200"
                    data-analytics-event="dashboard_home_cta_clicked"
                    data-analytics-cta="view_all_ai_news"
                    data-analytics-location="ai_news_header"
                    data-analytics-destination="/dashboard/ai-news/"
                  >
                    View all
                  </a>
                </div>
                <div data-dashboard-home-news-list="1" className="space-y-3">
                  <a
                    href="/dashboard/ai-news/"
                    data-dashboard-home-news-card="1"
                    className="block glass p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 hover:bg-white/5 transition flex gap-3"
                    data-analytics-event="dashboard_home_cta_clicked"
                    data-analytics-cta="open_ai_news"
                    data-analytics-location="ai_news_card"
                    data-analytics-destination="/dashboard/ai-news/"
                  >
                    <div className="w-8 h-8 rounded shrink-0 bg-sky-500/20 flex items-center justify-center text-sky-400">
                      <span className="runtime-loader-spinner runtime-loader-spinner-sm"></span>
                    </div>
                    <div>
                      <h4 className="font-medium text-white text-sm mb-0.5">Preparing AI News</h4>
                      <p className="text-xs text-gray-400 line-clamp-2">Here are relevant AI news stories so you can stay current on what impacts your role.</p>
                    </div>
                  </a>
                  <a
                    href="/dashboard/ai-news/"
                    data-dashboard-home-news-card="1"
                    className="block glass p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 hover:bg-white/5 transition flex gap-3"
                    data-analytics-event="dashboard_home_cta_clicked"
                    data-analytics-cta="open_ai_news_cache_warm"
                    data-analytics-location="ai_news_card"
                    data-analytics-destination="/dashboard/ai-news/"
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
