import { DashboardShell } from "@/components/dashboard-runtime-shell";
import { getDashboardServerState } from "@/app/dashboard/_lib";

export default async function DashboardChatPage() {
  const state = await getDashboardServerState();
  const user = state.user;
  const activeProject = state.activeProject;
  const introText = activeProject?.title
    ? `I’m your AI Tutor. Let’s continue ${activeProject.title}. Share your current blocker and I’ll give concrete next steps plus a verification check.`
    : "I’m your AI Tutor. Share your current blocker and I’ll give concrete next steps plus a verification check.";
  return (
    <DashboardShell
      activeTab="chat"
      headerTitle="My AI Skill Tutor Session"
      headerSubtitle={activeProject?.title ? `${activeProject.title} • Active Build` : "Active build"}
      hideHeaderActionsOnMobile
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
      decor={
        <>
          <div className="absolute inset-0 bg-glow opacity-30 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute top-0 right-1/4 w-[300px] h-[300px] bg-emerald-500/10 blur-[100px] pointer-events-none z-0"></div>
        </>
      }
      headerActions={(
        <>
          <button className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-gray-400 border border-transparent hover:border-white/10 transition text-xs">
            <i className="fa-solid fa-code"></i> View Code/Artifact
          </button>
          <button className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-gray-400 border border-transparent hover:border-white/10 transition text-xs">
            <i className="fa-solid fa-ellipsis-vertical"></i>
          </button>
        </>
      )}
    >
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 z-10 custom-scrollbar pr-4">
        <div className="flex justify-center">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold px-4 py-1 rounded-full bg-black/20 border border-white/5">
            Today
          </span>
        </div>
        <div className="flex items-start gap-4 max-w-4xl">
          <div className="w-8 h-8 rounded-full bg-gradient-to-b from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
            <i className="fa-solid fa-robot text-white text-[10px]"></i>
          </div>
          <div className="glass p-5 rounded-2xl rounded-tl-sm text-sm border-emerald-500/20 bg-emerald-500/5">
            <p>{introText}</p>
          </div>
        </div>
        <div className="max-w-4xl pl-12">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Try asking</p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300">
              Summarize my blocker
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300">
              Turn this into next steps
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300">
              Draft a proof artifact update
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 bg-transparent z-20 flex-shrink-0 border-t border-white/5">
        <div className="max-w-4xl mx-auto relative glass-panel p-2 rounded-2xl border-white/10 flex items-end shadow-2xl bg-black/40">
          <button className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-gray-400 transition mb-0.5">
            <i className="fa-solid fa-paperclip"></i>
          </button>
          <textarea
            className="flex-1 bg-transparent border-0 text-white text-sm resize-none focus:ring-0 px-4 py-3 min-h-[50px] max-h-32 custom-scrollbar placeholder-gray-500"
            placeholder="Ask your AI Tutor or paste your code snippet..."
            rows={1}
          ></textarea>
          <button className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white transition mb-0.5 shadow-lg shadow-emerald-500/50">
            <i className="fa-solid fa-paper-plane text-xs ml-[-2px]"></i>
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-500 mt-3 font-medium">
          AI Tutor can make mistakes. Consider verifying critical generated code.
        </p>
      </div>
    </DashboardShell>
  );
}
