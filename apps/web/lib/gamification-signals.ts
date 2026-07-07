import "server-only";

import { effectiveCurrentStreak, type GamificationActivitySignals } from "@aitutor/shared";
import { countCompletedDailyActions, getStreak } from "@/lib/daily-action";
import { todayBriefingDate } from "@/lib/daily-briefing-store";
import { countTutorSessionMilestones } from "@/lib/tutor-session";

/**
 * Assembles the activity signals for `buildDashboardGamification` (rebuild
 * dashboard batch item 4): daily-action completions (`daily_actions`), streak
 * state (`learner_streaks`), and tutor-session milestones
 * (`module_tutor_sessions`).
 *
 * Extracted into its own module so `runtime.ts` never grows — the summary
 * assembly there only calls this and passes the result through. Dual-mode by
 * construction: every underlying store follows the repo's memory/supabase
 * convention.
 */
export async function collectGamificationActivitySignals(
  learnerProfileId: string,
  now: Date = new Date(),
): Promise<GamificationActivitySignals> {
  const [dailyActionsCompleted, streak, tutorMilestones] = await Promise.all([
    countCompletedDailyActions(learnerProfileId),
    getStreak(learnerProfileId),
    countTutorSessionMilestones(learnerProfileId),
  ]);

  return {
    dailyActionsCompleted,
    streakCurrent: effectiveCurrentStreak(streak, todayBriefingDate(now)),
    streakLongest: streak.longestStreak,
    streakLastActionDate: streak.lastActionDate,
    tutorSessionsStarted: tutorMilestones.started,
    tutorSessionsCompleted: tutorMilestones.completed,
    firstTutorSessionCompletedAt: tutorMilestones.firstCompletedAt,
  };
}

/**
 * Same collection, but failure-isolated for dashboard summary assembly:
 * gamification display must never take down the dashboard, so collection
 * errors degrade to "no activity signals" (the pre-item-4 behavior).
 */
export async function collectGamificationActivitySignalsSafe(
  learnerProfileId: string,
  now: Date = new Date(),
): Promise<GamificationActivitySignals | null> {
  try {
    return await collectGamificationActivitySignals(learnerProfileId, now);
  } catch (error) {
    console.warn(
      "[gamification] activity signal collection failed",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}
