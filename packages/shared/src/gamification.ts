import { getCareerPath } from "./matrix";
import type { AgentJobEvent, DashboardAchievement, DashboardBadge, DashboardGamification, Project, UserProfile } from "./types";

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
};

const LEVEL_THRESHOLDS = [0, 90, 180, 300, 450, 650];

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
  ];

  const xpTotal = achievements.reduce((sum, achievement) => sum + (achievement.unlocked ? achievement.xp : 0), 0);
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
