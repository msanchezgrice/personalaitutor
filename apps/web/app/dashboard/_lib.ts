import { getAuthSeed } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin-access";
import { billingAccessAllowed, normalizeBillingStatus } from "@/lib/billing";
import { runtimeGetBillingSubscription, runtimeGetDashboardSummary, runtimeGetOrCreateProfile } from "@/lib/runtime";
import { syncBillingFromCheckoutSession } from "@/lib/stripe-server";
import type {
  BillingSubscription,
  BillingSubscriptionStatus,
  DashboardSummary,
  Project,
  UserProfile,
} from "@aitutor/shared";

export type DashboardRuntimeBootstrap = {
  auth: {
    userId: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  summary: DashboardSummary | null;
};

export type DashboardServerState = {
  seed: Awaited<ReturnType<typeof getAuthSeed>>;
  billing: {
    subscription: BillingSubscription | null;
    status: BillingSubscriptionStatus;
    accessAllowed: boolean;
  };
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

async function getDashboardBillingState(
  seed: Awaited<ReturnType<typeof getAuthSeed>>,
  options?: { checkoutSessionId?: string | null },
) {
  if (!seed?.userId) {
    return {
      subscription: null,
      status: "none" as BillingSubscriptionStatus,
      accessAllowed: false,
    };
  }

  const user = await runtimeGetOrCreateProfile({
    userId: seed.userId,
    name: seed.name,
    email: seed.email ?? null,
    avatarUrl: seed.avatarUrl ?? null,
    handleBase: seed.handleBase,
  });

  const checkoutSessionId = options?.checkoutSessionId?.trim();
  if (checkoutSessionId) {
    try {
      await syncBillingFromCheckoutSession({
        userId: user.id,
        sessionId: checkoutSessionId,
      });
    } catch (error) {
      console.warn("[billing] dashboard checkout sync failed", error instanceof Error ? error.message : "unknown");
    }
  }

  const subscription = await runtimeGetBillingSubscription(user.id);
  const status = normalizeBillingStatus(subscription?.status);
  return {
    subscription,
    status,
    accessAllowed: billingAccessAllowed(status),
  };
}

export async function getDashboardBillingGateState(options?: { checkoutSessionId?: string | null }) {
  const seed = await getAuthSeed();
  return getDashboardBillingState(seed, options);
}

export function buildDashboardRuntimeBootstrap(state: DashboardServerState): DashboardRuntimeBootstrap | null {
  const userId = state.seed?.userId?.trim();
  if (!userId) return null;

  return {
    auth: {
      userId,
      name: state.seed?.name ?? state.user?.name ?? null,
      email: state.seed?.email ?? state.user?.contactEmail ?? null,
      avatarUrl: state.seed?.avatarUrl ?? state.user?.avatarUrl ?? null,
    },
    summary: state.summary,
  };
}

export async function getDashboardServerState(options?: { checkoutSessionId?: string | null }): Promise<DashboardServerState> {
  const seed = await getAuthSeed();
  const billing = await getDashboardBillingState(seed, options);
  if (!seed?.userId) {
    return {
      seed,
      billing,
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
    null;
  const completedProject =
    projects.find((project) => project.state === "built" || project.state === "showcased") ??
    null;
  const displayName = user?.name?.trim() || seed.name?.trim() || "Learner";
  const firstName = displayName.split(" ")[0] || displayName;
  const gamification = summary?.gamification;

  return {
    seed,
    billing,
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
