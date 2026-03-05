import { getAuthSeed } from "@/lib/auth";
import { runtimeGetDashboardSummary } from "@/lib/runtime";
import type { DashboardSummary, Project, UserProfile } from "@aitutor/shared";

export type DashboardServerState = {
  seed: Awaited<ReturnType<typeof getAuthSeed>>;
  summary: DashboardSummary | null;
  user: UserProfile | null;
  activeProject: Project | null;
  completedProject: Project | null;
  publicProfileUrl: string | null;
  greeting: string;
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
      publicProfileUrl: null,
      greeting: `${greetingForServerTime()}, there 👋`,
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
    projects[1] ??
    null;
  const displayName = user?.name?.trim() || seed.name?.trim() || "Learner";
  const firstName = displayName.split(" ")[0] || displayName;

  return {
    seed,
    summary,
    user,
    activeProject,
    completedProject,
    publicProfileUrl: user?.handle ? `/u/${user.handle}/` : null,
    greeting: `${greetingForServerTime()}, ${firstName} 👋`,
  };
}

