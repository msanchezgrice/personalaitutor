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
  hideHeaderActionsOnMobile?: boolean;
  children: ReactNode;
  decor?: ReactNode;
  initialUser?: {
    name?: string | null;
    headline?: string | null;
    avatarUrl?: string | null;
    publicProfileUrl?: string | null;
    levelLabel?: string | null;
    levelSubtitle?: string | null;
    levelProgressPct?: number | null;
    levelProgressText?: string | null;
  } | null;
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

export function DashboardShell({
  activeTab,
  headerTitle,
  headerSubtitle,
  headerActions,
  hideHeaderActionsOnMobile = false,
  children,
  decor,
  initialUser,
}: DashboardShellProps) {
  const displayName = initialUser?.name?.trim() || "Learner";
  const displayHeadline = initialUser?.headline?.trim() || "AI Builder";
  const avatarUrl = initialUser?.avatarUrl?.trim() || "/assets/avatar.png";
  const publicProfileUrl = initialUser?.publicProfileUrl?.trim() || "#";
  const levelLabel = initialUser?.levelLabel?.trim() || "Level 1";
  const levelSubtitle = initialUser?.levelSubtitle?.trim() || "Starter Builder";
  const levelProgressPct = Math.max(0, Math.min(100, Number(initialUser?.levelProgressPct ?? 20)));
  const levelProgressText = initialUser?.levelProgressText?.trim() || "Start building to level up";
  return (
    <>
      <DashboardRouteHydrator />
      <div
        data-gemini-shell="1"
        className="bg-[#0f111a] text-white lg:flex lg:h-screen lg:overflow-hidden min-h-screen text-sm"
        suppressHydrationWarning
      >
        <aside
          id="dashboard-sidebar"
          className="w-full lg:w-72 glass border-y-0 border-l-0 rounded-none flex flex-col lg:h-full bg-black/20 flex-shrink-0 z-20 relative"
        >
          <div className="p-6">
            <Link
              href="/"
              className="flex items-center gap-2 mb-8"
              data-analytics-event="dashboard_brand_clicked"
              data-analytics-location="sidebar"
              data-analytics-destination="/"
            >
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
              data-sidebar-profile="1"
              data-analytics-event="dashboard_nav_clicked"
              data-analytics-location="sidebar_profile"
              data-analytics-tab="profile"
              data-analytics-destination="/dashboard/profile"
            >
              <img
                src={avatarUrl}
                className="w-10 h-10 rounded-full object-cover border border-white/20"
                alt={displayName}
              />
              <div className="overflow-hidden">
                <div data-sidebar-profile-name="1" className="font-medium text-white truncate min-h-[1.25rem]">
                  {displayName}
                </div>
                <div data-sidebar-profile-role="1" className="text-xs text-emerald-400 truncate min-h-[1rem]">
                  {displayHeadline}
                </div>
              </div>
            </Link>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const active = activeTab === item.key;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={navLinkClassName(active, item.activeClassName)}
                    data-analytics-event="dashboard_nav_clicked"
                    data-analytics-location="sidebar_nav"
                    data-analytics-tab={item.key}
                    data-analytics-destination={item.href}
                  >
                    <i className={navIconClassName(item, active)}></i>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto p-6 space-y-4">
            <div
              data-sidebar-level-card="1"
              className="bg-gradient-to-br from-emerald-900/40 to-teal-900/40 border border-emerald-500/20 p-4 rounded-xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/20 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
              <div data-sidebar-level-label="1" className="flex items-center gap-2 text-white font-medium mb-1">
                <img src="/assets/badge.png" className="w-5 h-5" alt="badge" /> {levelLabel}
              </div>
              <p data-sidebar-level-subtitle="1" className="text-xs text-gray-400 mb-3">{levelSubtitle}</p>
              <div className="w-full bg-black/40 h-1.5 rounded-full">
                <div
                  data-sidebar-level-progress="1"
                  className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full shadow-[0_0_5px_rgba(79,70,229,0.5)]"
                  style={{ width: `${levelProgressPct}%` }}
                ></div>
              </div>
              <p data-sidebar-level-progress-text="1" className="text-[10px] text-gray-500 mt-2 text-right">{levelProgressText}</p>
            </div>

            <a
              href={publicProfileUrl}
              aria-disabled={publicProfileUrl === "#" ? "true" : undefined}
              data-public-profile-link="1"
              data-analytics-event="public_profile_clicked"
              data-analytics-location="sidebar"
              data-analytics-destination={publicProfileUrl}
              className={
                "flex items-center justify-between px-4 py-2 text-gray-400 text-xs border border-white/10 rounded-lg transition" +
                (publicProfileUrl === "#" ? " opacity-50 pointer-events-none" : "")
              }
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
          <header
            data-dashboard-header="1"
            className="h-20 flex items-center px-4 md:px-8 lg:px-10 border-b border-white/5 sticky top-0 bg-[#0f111a]/80 backdrop-blur-xl z-10 flex-shrink-0"
          >
            <button
              id="dashboard-mobile-nav-toggle"
              type="button"
              data-mobile-nav-toggle="1"
              aria-controls="dashboard-sidebar"
              aria-expanded="false"
              aria-label="Open menu"
              className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-gray-200"
            >
              <i className="fa-solid fa-bars text-sm"></i>
            </button>
            <div data-dashboard-header-title="1" className="min-w-0 flex-1">
              <h1 className="text-xl font-[Outfit] font-semibold break-words">{headerTitle}</h1>
              {headerSubtitle ? <p className="text-xs text-gray-400">{headerSubtitle}</p> : null}
            </div>
            {headerActions ? (
              <div
                data-dashboard-header-actions="1"
                data-mobile-hidden={hideHeaderActionsOnMobile ? "1" : undefined}
                className={`${hideHeaderActionsOnMobile ? "hidden lg:flex" : "flex"} items-center gap-4`}
              >
                {headerActions}
              </div>
            ) : null}
            <div data-dashboard-header-settings="1" className="flex flex-shrink-0 items-center justify-end">
              <DashboardSettingsMenu />
            </div>
          </header>
          <div data-dashboard-route="1" className="contents">
            {children}
          </div>
        </main>
      </div>
      <Script src="/gemini-runtime.js" strategy="afterInteractive" />
    </>
  );
}
