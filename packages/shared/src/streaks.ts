/**
 * Daily-action streaks (rebuild Phase 3.5). Pure calendar logic — persistence
 * lives in `apps/web/lib/daily-action.ts`, surfacing follows the
 * `gamification.ts` convention of deriving display state from stored signals.
 *
 * A "check-in" = completing the daily action. Dates are UTC calendar dates
 * (yyyy-mm-dd strings), matching the briefing/action date convention.
 */

export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  /** UTC calendar date (yyyy-mm-dd) of the last completed daily action. */
  lastActionDate: string | null;
};

export const EMPTY_STREAK: StreakState = {
  currentStreak: 0,
  longestStreak: 0,
  lastActionDate: null,
};

function parseDay(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** Whole-day difference between two yyyy-mm-dd dates (b - a). */
export function dayDifference(a: string, b: string): number | null {
  const dayA = parseDay(a);
  const dayB = parseDay(b);
  if (dayA === null || dayB === null) return null;
  return Math.round((dayB - dayA) / 86_400_000);
}

/**
 * Advance a streak for a completed daily action on `actionDate`.
 * - Same day again -> unchanged (idempotent; completing twice never double-counts).
 * - Consecutive day -> current + 1.
 * - Gap (or first ever) -> reset to 1.
 * - An out-of-order/backdated action never rewinds the streak.
 * `longestStreak` is monotonic.
 */
export function advanceStreak(state: StreakState, actionDate: string): StreakState {
  const normalizedDate = actionDate.trim();
  if (parseDay(normalizedDate) === null) {
    throw new Error("STREAK_INVALID_DATE");
  }

  const current = Math.max(0, Math.floor(state.currentStreak || 0));
  const longest = Math.max(0, Math.floor(state.longestStreak || 0), current);

  if (!state.lastActionDate) {
    const next = { currentStreak: 1, longestStreak: Math.max(longest, 1), lastActionDate: normalizedDate };
    return next;
  }

  const diff = dayDifference(state.lastActionDate, normalizedDate);
  if (diff === null) {
    // Stored date is corrupt — restart the streak rather than guessing.
    return { currentStreak: 1, longestStreak: Math.max(longest, 1), lastActionDate: normalizedDate };
  }

  if (diff <= 0) {
    // Same day (idempotent) or backdated completion: keep the streak as-is.
    return { currentStreak: current, longestStreak: longest, lastActionDate: state.lastActionDate };
  }

  const nextCurrent = diff === 1 ? current + 1 : 1;
  return {
    currentStreak: nextCurrent,
    longestStreak: Math.max(longest, nextCurrent),
    lastActionDate: normalizedDate,
  };
}

/**
 * The streak shown on the dashboard/email: a streak is only "alive" if the
 * last check-in was today or yesterday relative to `today`.
 */
export function effectiveCurrentStreak(state: StreakState, today: string): number {
  if (!state.lastActionDate) return 0;
  const diff = dayDifference(state.lastActionDate, today);
  if (diff === null || diff > 1 || diff < 0) return 0;
  return Math.max(0, Math.floor(state.currentStreak || 0));
}
