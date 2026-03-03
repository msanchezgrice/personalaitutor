import Link from "next/link";
import { getAuthSeed } from "@/lib/auth";
import { runtimeGenerateSocialIdeas, runtimeGetDashboardSummary } from "@/lib/runtime";
import { BRAND_NAME } from "@/lib/site";
import { SocialMediaComposer } from "./social-media-composer";

export const dynamic = "force-dynamic";

export default async function DashboardSocialPage() {
  const seed = await getAuthSeed();
  if (!seed?.userId) {
    return (
      <main className="min-h-screen bg-[#0f111a] text-white flex items-center justify-center p-6">
        <div className="glass p-8 rounded-2xl max-w-md w-full text-center">
          <h1 className="text-2xl font-[Outfit] mb-2">Sign in required</h1>
          <p className="text-sm text-gray-300 mb-6">Please sign in to access your social media drafts.</p>
          <a href="/sign-in" className="btn btn-primary">
            Go to Sign In
          </a>
        </div>
      </main>
    );
  }

  const summary = await runtimeGetDashboardSummary(seed.userId, {
    name: seed.name,
    handleBase: seed.handleBase,
    avatarUrl: seed.avatarUrl ?? null,
    email: seed.email ?? null,
  });

  if (!summary) {
    return (
      <main className="min-h-screen bg-[#0f111a] text-white flex items-center justify-center p-6">
        <div className="glass p-8 rounded-2xl max-w-md w-full text-center">
          <h1 className="text-2xl font-[Outfit] mb-2">Profile unavailable</h1>
          <p className="text-sm text-gray-300 mb-6">Your dashboard profile could not be loaded right now.</p>
          <Link href="/dashboard" className="btn btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const activeProject =
    summary.projects.find((entry) => entry.state === "building" || entry.state === "built" || entry.state === "showcased") ??
    summary.projects[0] ??
    null;

  const ideas = await runtimeGenerateSocialIdeas({
    userId: summary.user.id,
    projectId: activeProject?.id ?? null,
    seed: {
      name: seed.name,
      handleBase: seed.handleBase,
      avatarUrl: seed.avatarUrl ?? null,
      email: seed.email ?? null,
    },
  });

  const initialIdeas = ideas.ok
    ? ideas.ideas
    : {
        linkedin: `Building with ${BRAND_NAME} and sharing proof publicly.`,
        x: `Building in public with ${BRAND_NAME}.`,
        contextLabel: activeProject ? `Project: ${activeProject.title}` : "Profile momentum",
        targetUrl: `/u/${summary.user.handle}/`,
      };

  return (
    <div className="bg-[#0f111a] text-white lg:flex lg:h-screen lg:overflow-hidden min-h-screen text-sm">
      <aside className="w-full lg:w-72 glass border-y-0 border-l-0 rounded-none flex flex-col lg:h-full bg-black/20 flex-shrink-0 z-20 relative">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xl shadow-[0_0_15px_rgba(79,70,229,0.5)]">
              <i className="fa-solid fa-brain text-sm" />
            </div>
            <span className="font-[Outfit] font-bold text-lg tracking-tight text-white">{BRAND_NAME}</span>
          </Link>

          <Link
            href="/dashboard/profile"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition border border-transparent hover:border-white/10 mb-8 cursor-pointer"
          >
            <img
              src={summary.user.avatarUrl || "/assets/avatar.png"}
              className="w-10 h-10 rounded-full object-cover border border-white/20"
              alt={summary.user.name}
            />
            <div className="overflow-hidden">
              <div className="font-medium text-white truncate">{summary.user.name}</div>
              <div className="text-xs text-emerald-400 truncate">{summary.user.headline || "AI Builder"}</div>
            </div>
          </Link>

          <nav className="space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition group"
            >
              <i className="fa-solid fa-house w-5 text-center group-hover:text-emerald-400 transition-colors" /> Home
            </Link>
            <Link
              href="/dashboard/chat"
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition group"
            >
              <i className="fa-solid fa-message w-5 text-center group-hover:text-amber-400 transition-colors" /> Chat Tutor
            </Link>
            <Link
              href="/dashboard/projects"
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition group"
            >
              <i className="fa-solid fa-folder-open w-5 text-center group-hover:text-amber-400 transition-colors" /> Projects
            </Link>
            <Link
              href="/dashboard/social"
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#0077b5]/20 text-[#0077b5] border border-[#0077b5]/30"
            >
              <i className="fa-solid fa-share-nodes w-5 text-center font-bold drop-shadow-[0_0_8px_rgba(0,119,181,0.6)]" /> Social
              Media
            </Link>
            <Link
              href="/dashboard/updates"
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition group flex justify-between"
            >
              <span className="flex items-center gap-3">
                <i className="fa-solid fa-bell w-5 text-center group-hover:text-coral-400 transition-colors" />
                <span>Updates</span>
              </span>
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">2</span>
            </Link>
          </nav>
        </div>
      </aside>

      <main className="flex-1 flex flex-col lg:h-full relative overflow-y-auto w-full min-w-0">
        <header className="h-20 flex items-center justify-between px-4 md:px-8 lg:px-10 border-b border-white/5 sticky top-0 bg-[#0f111a]/80 backdrop-blur-xl z-10 flex-shrink-0">
          <div>
            <h1 className="text-xl font-[Outfit] font-semibold flex items-center gap-3">
              <i className="fa-solid fa-share-nodes text-[#0077b5]" /> Social Media
            </h1>
            <p className="text-xs text-gray-400">Generate, edit, and share your latest project proof across social channels.</p>
          </div>
          <div className="fixed top-4 right-4 z-[100]">
            <button
              id="theme-toggle"
              className="btn bg-white/10 hover:bg-white/20 text-white border border-white/10 px-3 py-2 rounded-lg flex items-center justify-center transition-colors"
              aria-label="Toggle dark mode"
            >
              <i className="fa-solid fa-sun" id="theme-icon" />
            </button>
          </div>
        </header>

        <div className="p-6 md:p-10 max-w-5xl mx-auto w-full pb-24">
          <SocialMediaComposer
            userId={summary.user.id}
            projectId={activeProject?.id ?? null}
            userName={summary.user.name}
            userHeadline={summary.user.headline || "AI Builder"}
            initialLinkedin={initialIdeas.linkedin}
            initialTweet={initialIdeas.x}
            initialContext={initialIdeas.contextLabel}
            initialSource={ideas.ok ? ideas.source : "fallback"}
          />
        </div>
      </main>
    </div>
  );
}
