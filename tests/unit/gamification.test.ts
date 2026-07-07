import { describe, expect, test } from "vitest";
import { buildDashboardGamification, type GamificationActivitySignals } from "@aitutor/shared";
import type { UserProfile } from "@aitutor/shared";

/**
 * XP wiring for the new loop (dashboard batch item 4): daily-action
 * completions, streaks, and tutor-session milestones feed XP and two new
 * achievements. An active week 1 (5 daily actions + 1 completed tutor
 * session) must reach Level 2 (90 XP).
 */

function baseUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "user-1",
    handle: "user-1",
    name: "",
    headline: "",
    bio: "",
    avatarUrl: null,
    contactEmail: null,
    careerPathId: "marketing-seo",
    goals: [],
    skills: [],
    published: false,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } as UserProfile;
}

function baseSignals(activity?: Partial<GamificationActivitySignals> | null) {
  return {
    user: baseUser(),
    projects: [],
    latestEvents: [],
    hasOnboardingSession: false,
    onboardingStartedAt: null,
    hasCompletedAssessment: false,
    assessmentSubmittedAt: null,
    hasSocialDraft: false,
    socialDraftCreatedAt: null,
    hasPublishedSocialDraft: false,
    socialDraftPublishedAt: null,
    activity: activity ?? null,
  };
}

describe("gamification activity XP (daily actions, streaks, tutor sessions)", () => {
  test("no activity signals keeps the legacy behavior (backward compatible)", () => {
    const withOmitted = buildDashboardGamification({
      user: baseUser(),
      projects: [],
      latestEvents: [],
      hasOnboardingSession: false,
      hasCompletedAssessment: false,
      hasSocialDraft: false,
      hasPublishedSocialDraft: false,
    });
    const withNull = buildDashboardGamification(baseSignals(null));
    expect(withOmitted.xpTotal).toBe(0);
    expect(withNull.xpTotal).toBe(0);
    expect(withOmitted.level).toBe(1);
  });

  test("each completed daily action is worth 10 XP", () => {
    const result = buildDashboardGamification(baseSignals({ dailyActionsCompleted: 3 }));
    expect(result.xpTotal).toBe(30);
  });

  test("each completed tutor session is worth 25 XP plus milestone rewards", () => {
    const result = buildDashboardGamification(
      baseSignals({
        tutorSessionsStarted: 1,
        tutorSessionsCompleted: 1,
        firstTutorSessionCompletedAt: "2026-07-05T12:00:00.000Z",
      }),
    );
    // 25 (completion) + 10 (first session started) + 60 (achievement)
    expect(result.xpTotal).toBe(95);
    const achievement = result.achievements.find((entry) => entry.key === "tutor_session_completed");
    expect(achievement?.unlocked).toBe(true);
    expect(achievement?.xp).toBe(60);
    expect(achievement?.unlockedAt).toBe("2026-07-05T12:00:00.000Z");
  });

  test("starting a tutor session without completing grants the one-time start XP only", () => {
    const result = buildDashboardGamification(baseSignals({ tutorSessionsStarted: 2 }));
    expect(result.xpTotal).toBe(10);
    const achievement = result.achievements.find((entry) => entry.key === "tutor_session_completed");
    expect(achievement?.unlocked).toBe(false);
  });

  test("a 7-day streak unlocks the Seven-Day Streak achievement (70 XP)", () => {
    const result = buildDashboardGamification(
      baseSignals({ streakCurrent: 7, streakLongest: 7, streakLastActionDate: "2026-07-07" }),
    );
    const achievement = result.achievements.find((entry) => entry.key === "streak_7");
    expect(achievement?.unlocked).toBe(true);
    expect(achievement?.xp).toBe(70);
    expect(result.xpTotal).toBe(70);
  });

  test("a broken streak keeps the achievement via longest streak (no re-locking)", () => {
    const result = buildDashboardGamification(
      baseSignals({ streakCurrent: 1, streakLongest: 9, streakLastActionDate: "2026-07-07" }),
    );
    expect(result.achievements.find((entry) => entry.key === "streak_7")?.unlocked).toBe(true);
  });

  test("a 6-day streak does not unlock the achievement", () => {
    const result = buildDashboardGamification(baseSignals({ streakCurrent: 6, streakLongest: 6 }));
    expect(result.achievements.find((entry) => entry.key === "streak_7")?.unlocked).toBe(false);
    expect(result.xpTotal).toBe(0);
  });

  test("active week 1: 5 daily actions + 1 completed tutor session reaches Level 2", () => {
    const result = buildDashboardGamification(
      baseSignals({
        dailyActionsCompleted: 5,
        streakCurrent: 5,
        streakLongest: 5,
        tutorSessionsStarted: 1,
        tutorSessionsCompleted: 1,
        firstTutorSessionCompletedAt: "2026-07-06T12:00:00.000Z",
      }),
    );
    // 50 (actions) + 25 (session) + 10 (started) + 60 (achievement) = 145
    expect(result.xpTotal).toBe(145);
    expect(result.level).toBe(2);
    expect(result.nextLevel).toBe(3);
  });

  test("activity XP stacks with legacy achievement XP", () => {
    const result = buildDashboardGamification({
      ...baseSignals({ dailyActionsCompleted: 2 }),
      hasCompletedAssessment: true,
      assessmentSubmittedAt: "2026-07-02T00:00:00.000Z",
    });
    // 45 (assessment achievement) + 20 (2 daily actions)
    expect(result.xpTotal).toBe(65);
  });

  test("negative or malformed counts never subtract XP", () => {
    const result = buildDashboardGamification(
      baseSignals({ dailyActionsCompleted: -3, tutorSessionsCompleted: -1, tutorSessionsStarted: -2 }),
    );
    expect(result.xpTotal).toBe(0);
    expect(result.level).toBe(1);
  });
});
