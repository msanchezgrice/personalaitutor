import { getAuthSeed } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-access";
import { runtimeGetDashboardSummary } from "@/lib/runtime";
import type { DashboardSummary, Project, UserProfile } from "@aitutor/shared";

export type DashboardServerState = {
  seed: Awaited<ReturnType<typeof getAuthSeed>>;
  summary: DashboardSummary | null;
  user: UserProfile | null;
  activeProject: Project | null;
  completedProject: Project | null;
  sidebarLevel: {
    level: number;
    label: string;
    subtitle: string;
    progressPct: number;
    progressText: string;
    xpTotal: number;
  };
  publicProfileUrl: string | null;
  greeting: string;
  isAdmin: boolean;
  operatorToolsUrl: string | null;
};

function greetingForServerTime(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export async function getDashboardServerState(): Promise<DashboardServerState> {
  const seed = await getAuthSeed();
  if (!seed?.userId) {
    return {
      seed,
      summary: null,
      user: null,
      activeProject: null,
      completedProject: null,
      sidebarLevel: {
        level: 1,
        label: "Level 1",
        subtitle: "Starter Builder",
        progressPct: 20,
        progressText: "Start building to level up",
        xpTotal: 0,
      },
      publicProfileUrl: null,
      greeting: `${greetingForServerTime()}, there 👋`,
      isAdmin: false,
      operatorToolsUrl: null,
    };
  }

  const summary = await runtimeGetDashboardSummary(seed.userId, {
    name: seed.name,
    handleBase: seed.handleBase,
    avatarUrl: seed.avatarUrl ?? null,
    email: seed.email ?? null,
  });

  const user = summary?.user ?? null;
  const projects = summary?.projects ?? [];
  const activeProject =
    projects.find((project) => project.state === "building" || project.state === "planned" || project.state === "idea") ??
    projects[0] ??
    null;
  const completedProject =
    projects.find((project) => project.state === "built" || project.state === "showcased") ??
    null;
  const displayName = user?.name?.trim() || seed.name?.trim() || "Learner";
  const firstName = displayName.split(" ")[0] || displayName;
  const gamification = summary?.gamification;

  return {
    seed,
    summary,
    user,
    activeProject,
    completedProject,
    sidebarLevel: {
      level: gamification?.level ?? 1,
      label: gamification?.levelLabel ?? "Level 1",
      subtitle: gamification?.levelSubtitle ?? "Starter Builder",
      progressPct: gamification?.levelProgressPct ?? 20,
      progressText: gamification?.levelProgressText ?? "Start building to level up",
      xpTotal: gamification?.xpTotal ?? 0,
    },
    publicProfileUrl: user?.published && user?.handle ? `/u/${user.handle}/` : null,
    greeting: `${greetingForServerTime()}, ${firstName} 👋`,
    isAdmin: isAdminEmail(seed.email),
    operatorToolsUrl: isAdminEmail(seed.email) ? "/dashboard/admin/signups" : null,
  };
}
