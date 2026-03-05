import Link from "next/link";
import type { ReactNode } from "react";
import Script from "next/script";
import { DashboardRouteHydrator } from "@/components/dashboard-route-hydrator";
import { DashboardSettingsMenu } from "@/components/dashboard-settings-menu";

type DashboardTab = "home" | "chat" | "projects" | "social" | "ai-news" | "activity" | "profile";

type DashboardShellProps = {
  activeTab: DashboardTab;
  headerTitle: ReactNode;
  headerSubtitle?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  decor?: ReactNode;
};

type DashboardHref =
  | "/dashboard"
  | "/dashboard/chat"
  | "/dashboard/projects"
  | "/dashboard/social"
  | "/dashboard/ai-news"
  | "/dashboard/updates";

type NavItem = {
  key: Exclude<DashboardTab, "profile">;
  href: DashboardHref;
  label: string;
  icon: string;
  activeClassName: string;
  iconClassName: string;
};

const navItems: NavItem[] = [
  {
    key: "home",
    href: "/dashboard",
    label: "Home",
    icon: "fa-house",
    activeClassName: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    iconClassName: "text-emerald-400",
  },
  {
    key: "chat",
    href: "/dashboard/chat",
    label: "Chat Tutor",
    icon: "fa-message",
    activeClassName: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    iconClassName: "text-emerald-400",
  },
  {
    key: "projects",
    href: "/dashboard/projects",
    label: "Projects",
    icon: "fa-folder-open",
    activeClassName: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    iconClassName: "text-amber-400",
  },
  {
    key: "social",
    href: "/dashboard/social",
    label: "Social Drafts",
    icon: "fa-share-nodes",
    activeClassName: "bg-[#0077b5]/20 text-[#0077b5] border border-[#0077b5]/30",
    iconClassName: "text-[#0077b5]",
  },
  {
    key: "ai-news",
    href: "/dashboard/ai-news",
    label: "AI News",
    icon: "fa-newspaper",
    activeClassName: "bg-sky-500/20 text-sky-400 border border-sky-500/30",
    iconClassName: "text-sky-400",
  },
  {
    key: "activity",
    href: "/dashboard/updates",
    label: "Activity",
    icon: "fa-clock-rotate-left",
    activeClassName: "bg-white/10 text-white border border-white/15",
    iconClassName: "text-white",
  },
];

function navLinkClassName(active: boolean, activeClassName: string) {
  if (active) {
    return "flex items-center gap-3 px-4 py-2.5 rounded-lg transition " + activeClassName;
  }
  return "flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition group";
}

function navIconClassName(item: NavItem, active: boolean) {
  if (active) {
    return "fa-solid " + item.icon + " w-5 text-center " + item.iconClassName;
  }
  return "fa-solid " + item.icon + " w-5 text-center";
}

export function DashboardShell({ activeTab, headerTitle, headerSubtitle, headerActions, children, decor }: DashboardShellProps) {
  return (
    <>
      <DashboardRouteHydrator />
      <div
        data-gemini-shell="1"
        className="bg-[#0f111a] text-white lg:flex lg:h-screen lg:overflow-hidden min-h-screen text-sm"
        suppressHydrationWarning
      >
        <aside className="w-full lg:w-72 glass border-y-0 border-l-0 rounded-none flex flex-col lg:h-full bg-black/20 flex-shrink-0 z-20 relative">
          <div className="p-6">
            <Link href="/" className="flex items-center gap-2 mb-8">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xl shadow-[0_0_15px_rgba(79,70,229,0.5)]">
                <i className="fa-solid fa-brain text-sm"></i>
              </div>
              <span className="font-[Outfit] font-bold text-lg tracking-tight text-white">My AI Skill Tutor</span>
            </Link>

            <Link
              href="/dashboard/profile"
              className={
                activeTab === "profile"
                  ? "flex items-center gap-3 p-3 rounded-lg border border-white/20 bg-white/5 mb-8 cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                  : "flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition border border-transparent hover:border-white/10 mb-8 cursor-pointer"
              }
            >
              <img
                src="/assets/avatar.png"
                className="w-10 h-10 rounded-full object-cover border border-white/20"
                alt="New Learner"
              />
              <div className="overflow-hidden">
                <div className="font-medium text-white truncate">New Learner</div>
                <div className="text-xs text-emerald-400 truncate">AI Builder</div>
              </div>
            </Link>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const active = activeTab === item.key;
                return (
                  <Link key={item.href} href={item.href} className={navLinkClassName(active, item.activeClassName)}>
                    <i className={navIconClassName(item, active)}></i>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto p-6 space-y-4">
            <div className="bg-gradient-to-br from-emerald-900/40 to-teal-900/40 border border-emerald-500/20 p-4 rounded-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/20 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
              <div className="flex items-center gap-2 text-white font-medium mb-1">
                <img src="/assets/badge.png" className="w-5 h-5" alt="badge" /> Level 1
              </div>
              <p className="text-xs text-gray-400 mb-3">Starter Builder</p>
              <div className="w-full bg-black/40 h-1.5 rounded-full">
                <div className="bg-gradient-to-r from-emerald-500 to-cyan-400 w-[20%] h-full rounded-full shadow-[0_0_5px_rgba(79,70,229,0.5)]"></div>
              </div>
              <p className="text-[10px] text-gray-500 mt-2 text-right">Start building to level up</p>
            </div>

            <a
              href="/u/alex-chen-ai/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between px-4 py-2 text-gray-400 hover:text-white text-xs border border-white/10 rounded-lg hover:border-white/20 transition"
            >
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-globe"></i> Public Profile
              </span>
              <i className="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          </div>
        </aside>

        <main className="flex-1 flex flex-col lg:h-full relative overflow-y-auto w-full min-w-0">
          {decor ?? <div className="absolute top-0 left-1/4 w-[500px] h-[200px] bg-emerald-500/20 blur-[100px] pointer-events-none"></div>}
          <header className="h-20 flex items-center justify-between px-4 md:px-8 lg:px-10 border-b border-white/5 sticky top-0 bg-[#0f111a]/80 backdrop-blur-xl z-10 flex-shrink-0">
            <div>
              <h1 className="text-xl font-[Outfit] font-semibold">{headerTitle}</h1>
              {headerSubtitle ? <p className="text-xs text-gray-400">{headerSubtitle}</p> : null}
            </div>
            <div className="flex items-center gap-4">{headerActions}<DashboardSettingsMenu /></div>
          </header>
          {children}
        </main>
      </div>
      <Script src="/gemini-runtime.js" strategy="afterInteractive" />
    </>
  );
}
