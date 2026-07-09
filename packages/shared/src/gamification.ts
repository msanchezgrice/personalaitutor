import { getCareerPath } from "./matrix";
import type { AgentJobEvent, DashboardAchievement, DashboardBadge, DashboardGamification, Project, UserProfile } from "./types";

/**
 * Activity signals for the retention loop (rebuild dashboard batch item 4):
 * daily-action completions (`daily_actions`), streaks (`learner_streaks`),
 * and tutor-session milestones (`module_tutor_sessions`). All optional so
 * legacy call sites keep their exact behavior.
 */
export type GamificationActivitySignals = {
  /** Count of completed daily actions (from the daily_actions store). */
  dailyActionsCompleted: number;
  /** Live streak (already normalized for display). */
  streakCurrent: number;
  /** All-time longest streak — achievements key off this so they never re-lock. */
  streakLongest: number;
  /** UTC yyyy-mm-dd of the last completed daily action (used as unlockedAt). */
  streakLastActionDate?: string | null;
  /** Tutor sessions ever started (module_tutor_sessions rows). */
  tutorSessionsStarted: number;
  /** Tutor sessions fully completed (steps + proof checklist done). */
  tutorSessionsCompleted: number;
  firstTutorSessionCompletedAt?: string | null;
};

type GamificationSignals = {
  user: UserProfile;
  projects: Project[];
  latestEvents: AgentJobEvent[];
  hasOnboardingSession: boolean;
  onboardingStartedAt?: string | null;
  hasCompletedAssessment: boolean;
  assessmentSubmittedAt?: string | null;
  hasSocialDraft: boolean;
  socialDraftCreatedAt?: string | null;
  hasPublishedSocialDraft: boolean;
  socialDraftPublishedAt?: string | null;
  activity?: Partial<GamificationActivitySignals> | null;
};

const LEVEL_THRESHOLDS = [0, 90, 180, 300, 450, 650];

// Activity XP: sized so an active week 1 (5 daily actions + 1 completed tutor
// session) crosses the Level 2 threshold (90 XP) on the new loop alone.
const XP_PER_DAILY_ACTION = 10;
const XP_PER_TUTOR_SESSION_COMPLETED = 25;
const XP_FIRST_TUTOR_SESSION_STARTED = 10;
const STREAK_ACHIEVEMENT_DAYS = 7;

function nonNegativeCount(value: number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function normalizeActivity(activity: Partial<GamificationActivitySignals> | null | undefined): GamificationActivitySignals {
  return {
    dailyActionsCompleted: nonNegativeCount(activity?.dailyActionsCompleted),
    streakCurrent: nonNegativeCount(activity?.streakCurrent),
    streakLongest: nonNegativeCount(activity?.streakLongest),
    streakLastActionDate: activity?.streakLastActionDate ?? null,
    tutorSessionsStarted: nonNegativeCount(activity?.tutorSessionsStarted),
    tutorSessionsCompleted: nonNegativeCount(activity?.tutorSessionsCompleted),
    firstTutorSessionCompletedAt: activity?.firstTutorSessionCompletedAt ?? null,
  };
}

function cleanText(value: string | null | undefined) {
  return String(value || "").trim();
}

function normalizeLower(value: string | null | undefined) {
  return cleanText(value).toLowerCase();
}

function hasEventMessage(events: AgentJobEvent[], fragments: string[]) {
  const normalized = fragments.map((fragment) => fragment.toLowerCase());
  return events.some((event) => {
    const text = `${normalizeLower(event.type)} ${normalizeLower(event.message)}`;
    return normalized.some((fragment) => text.includes(fragment));
  });
}

function firstEventAt(events: AgentJobEvent[], fragments: string[]) {
  const normalized = fragments.map((fragment) => fragment.toLowerCase());
  const matches = events
    .filter((event) => {
      const text = `${normalizeLower(event.type)} ${normalizeLower(event.message)}`;
      return normalized.some((fragment) => text.includes(fragment));
    })
    .map((event) => cleanText(event.createdAt))
    .filter(Boolean)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  return matches[0] ?? null;
}

function hasProjectOutput(projects: Project[]) {
  return projects.some((project) => Array.isArray(project.artifacts) && project.artifacts.length > 0);
}

function hasCompletedProject(projects: Project[]) {
  return projects.some((project) => project.state === "built" || project.state === "showcased");
}

function hasVerifiedSkill(user: UserProfile) {
  return user.skills.some((skill) => skill.status === "verified");
}

function hasProfileSetup(user: UserProfile) {
  return Boolean(cleanText(user.name) && cleanText(user.headline) && cleanText(user.bio));
}

function subtitleForLevel(level: number) {
  if (level <= 1) return "Starter Builder";
  if (level === 2) return "Active Builder";
  if (level === 3) return "Proof Builder";
  if (level === 4) return "Signal Operator";
  if (level === 5) return "Workflow Leader";
  return "AI Operator";
}

function computeLevel(xpTotal: number) {
  let level = 1;
  for (let index = 0; index < LEVEL_THRESHOLDS.length; index += 1) {
    if (xpTotal >= LEVEL_THRESHOLDS[index]) level = index + 1;
  }
  const cappedLevel = Math.min(level, LEVEL_THRESHOLDS.length);
  const nextLevel = cappedLevel < LEVEL_THRESHOLDS.length ? cappedLevel + 1 : null;
  const currentThreshold = LEVEL_THRESHOLDS[cappedLevel - 1] ?? 0;
  const nextThreshold = nextLevel ? LEVEL_THRESHOLDS[nextLevel - 1] : null;
  const levelProgressPct =
    nextThreshold && nextThreshold > currentThreshold
      ? Math.max(0, Math.min(100, Math.round(((xpTotal - currentThreshold) / (nextThreshold - currentThreshold)) * 100)))
      : 100;
  const xpToNextLevel = nextThreshold ? Math.max(0, nextThreshold - xpTotal) : null;
  const levelProgressText = nextLevel ? `${xpToNextLevel} XP to Level ${nextLevel}` : "Max level reached";

  return {
    level: cappedLevel,
    nextLevel,
    levelProgressPct,
    levelProgressText,
    xpToNextLevel,
  };
}

export function buildDashboardGamification(input: GamificationSignals): DashboardGamification {
  const activity = normalizeActivity(input.activity);
  const chatStarted = hasEventMessage(input.latestEvents, ["project.chat queued", "project.chat completed"]);
  const firstOutputGenerated =
    hasProjectOutput(input.projects) ||
    hasEventMessage(input.latestEvents, ["generation completed", "project.generate_website completed", "project.generate_artifact completed"]);
  const projectStarted = input.projects.length > 0;
  const completedProject = hasCompletedProject(input.projects);
  const verifiedSkill = hasVerifiedSkill(input.user);
  const profileSetup = hasProfileSetup(input.user);

  const achievements: DashboardAchievement[] = [
    {
      key: "profile_ready",
      title: "Workspace Activated",
      description: "Your profile basics are in place and the tutor workspace is ready.",
      xp: 20,
      unlocked: profileSetup,
      unlockedAt: profileSetup ? input.user.updatedAt : null,
    },
    {
      key: "onboarding_started",
      title: "First Signal Captured",
      description: "You started onboarding and gave the tutor real context.",
      xp: 25,
      unlocked: input.hasOnboardingSession,
      unlockedAt: input.hasOnboardingSession ? input.onboardingStartedAt ?? input.user.createdAt : null,
    },
    {
      key: "assessment_completed",
      title: "Direction Locked",
      description: "Assessment signals are in, so recommendations can be role-specific.",
      xp: 45,
      unlocked: input.hasCompletedAssessment,
      unlockedAt: input.hasCompletedAssessment ? input.assessmentSubmittedAt ?? null : null,
    },
    {
      key: "project_started",
      title: "Pack Starter",
      description: "You started a module pack and moved from planning into action.",
      xp: 35,
      unlocked: projectStarted,
      unlockedAt: projectStarted ? input.projects.map((project) => project.createdAt).sort()[0] ?? null : null,
    },
    {
      key: "chat_started",
      title: "AI Teammate Activated",
      description: "You used Chat Tutor to get unstuck and pick a next move.",
      xp: 20,
      unlocked: chatStarted,
      unlockedAt: chatStarted ? firstEventAt(input.latestEvents, ["project.chat queued", "project.chat completed"]) : null,
    },
    {
      key: "first_output",
      title: "Proof in Progress",
      description: "You generated your first visible artifact from module work.",
      xp: 60,
      unlocked: firstOutputGenerated,
      unlockedAt: firstOutputGenerated
        ? input.projects
            .flatMap((project) => project.artifacts.map((artifact) => artifact.createdAt))
            .sort()[0] ?? firstEventAt(input.latestEvents, ["generation completed"])
        : null,
    },
    {
      key: "social_draft_created",
      title: "Voice in Motion",
      description: "You generated social copy from your project work.",
      xp: 30,
      unlocked: input.hasSocialDraft,
      unlockedAt: input.hasSocialDraft ? input.socialDraftCreatedAt ?? null : null,
    },
    {
      key: "profile_published",
      title: "Spotlight On",
      description: "Your public profile is live and shareable.",
      xp: 40,
      unlocked: Boolean(input.user.published),
      unlockedAt: input.user.published ? input.user.updatedAt : null,
    },
    {
      key: "project_completed",
      title: "Outcome Shipped",
      description: "You finished a project and produced visible proof.",
      xp: 80,
      unlocked: completedProject,
      unlockedAt: completedProject
        ? input.projects
            .filter((project) => project.state === "built" || project.state === "showcased")
            .map((project) => project.updatedAt)
            .sort()[0] ?? null
        : null,
    },
    {
      key: "verified_skill",
      title: "Signal Verified",
      description: "At least one skill is now verified.",
      xp: 120,
      unlocked: verifiedSkill,
      unlockedAt: verifiedSkill ? input.user.updatedAt : null,
    },
    {
      key: "tutor_session_completed",
      title: "First Tutor Session Complete",
      description: "You finished a full tutor session — every step and proof item evidenced.",
      xp: 60,
      unlocked: activity.tutorSessionsCompleted > 0,
      unlockedAt: activity.tutorSessionsCompleted > 0 ? activity.firstTutorSessionCompletedAt ?? null : null,
    },
    {
      key: "streak_7",
      title: "Seven-Day Streak",
      description: "You completed your daily action seven days in a row.",
      xp: 70,
      unlocked: activity.streakLongest >= STREAK_ACHIEVEMENT_DAYS,
      unlockedAt: activity.streakLongest >= STREAK_ACHIEVEMENT_DAYS ? activity.streakLastActionDate ?? null : null,
    },
  ];

  const achievementXp = achievements.reduce((sum, achievement) => sum + (achievement.unlocked ? achievement.xp : 0), 0);
  const activityXp =
    activity.dailyActionsCompleted * XP_PER_DAILY_ACTION +
    activity.tutorSessionsCompleted * XP_PER_TUTOR_SESSION_COMPLETED +
    (activity.tutorSessionsStarted > 0 ? XP_FIRST_TUTOR_SESSION_STARTED : 0);
  const xpTotal = achievementXp + activityXp;
  const levelMeta = computeLevel(xpTotal);
  const badges: DashboardBadge[] = [
    {
      key: "pathfinder",
      title: "Pathfinder",
      description: "Started onboarding and completed the assessment.",
      unlocked: input.hasOnboardingSession && input.hasCompletedAssessment,
      unlockedAt: input.assessmentSubmittedAt ?? input.onboardingStartedAt ?? null,
    },
    {
      key: "builder_mode",
      title: "Builder Mode",
      description: "Started a pack and used Chat Tutor.",
      unlocked: projectStarted && chatStarted,
      unlockedAt: projectStarted
        ? input.projects.map((project) => project.createdAt).sort()[0] ?? firstEventAt(input.latestEvents, ["project.chat queued"])
        : null,
    },
    {
      key: "proof_runner",
      title: "Proof Runner",
      description: "Generated a visible artifact and social draft.",
      unlocked: firstOutputGenerated && input.hasSocialDraft,
      unlockedAt: input.socialDraftCreatedAt ?? null,
    },
    {
      key: "public_builder",
      title: "Public Builder",
      description: "Published your profile and shipped at least one project.",
      unlocked: Boolean(input.user.published) && completedProject,
      unlockedAt: completedProject
        ? input.projects
            .filter((project) => project.state === "built" || project.state === "showcased")
            .map((project) => project.updatedAt)
            .sort()[0] ?? input.user.updatedAt
        : null,
    },
    {
      key: "trusted_operator",
      title: "Trusted Operator",
      description: "Unlocked your first verified skill signal.",
      unlocked: verifiedSkill,
      unlockedAt: verifiedSkill ? input.user.updatedAt : null,
    },
  ];

  const primaryTrackId = input.user.careerPathId;
  const primaryTrackName = getCareerPath(primaryTrackId)?.name ?? "Current track";

  return {
    xpTotal,
    // Surfaced so the dashboard can show a total that visibly reconciles:
    // badge/achievement XP + activity XP (daily actions, tutor sessions).
    xpBreakdown: { achievements: achievementXp, activity: activityXp },
    level: levelMeta.level,
    levelLabel: `Level ${levelMeta.level}`,
    levelSubtitle: subtitleForLevel(levelMeta.level),
    levelProgressPct: levelMeta.levelProgressPct,
    levelProgressText: levelMeta.levelProgressText,
    nextLevel: levelMeta.nextLevel,
    xpToNextLevel: levelMeta.xpToNextLevel,
    primaryTrackId,
    primaryTrackName,
    achievements,
    badges,
  };
}
