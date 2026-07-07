import { describe, expect, test } from "vitest";
import { EMPTY_STREAK, advanceStreak, dayDifference, effectiveCurrentStreak } from "@aitutor/shared";

describe("streak advancement", () => {
  test("first ever check-in starts a streak of 1", () => {
    const next = advanceStreak(EMPTY_STREAK, "2026-07-07");
    expect(next).toEqual({ currentStreak: 1, longestStreak: 1, lastActionDate: "2026-07-07" });
  });

  test("consecutive-day check-in increments", () => {
    const day1 = advanceStreak(EMPTY_STREAK, "2026-07-06");
    const day2 = advanceStreak(day1, "2026-07-07");
    expect(day2.currentStreak).toBe(2);
    expect(day2.longestStreak).toBe(2);
    expect(day2.lastActionDate).toBe("2026-07-07");
  });

  test("same-day repeat is idempotent (no double count)", () => {
    const day1 = advanceStreak(EMPTY_STREAK, "2026-07-07");
    const again = advanceStreak(day1, "2026-07-07");
    expect(again).toEqual(day1);
  });

  test("a gap resets current but preserves longest", () => {
    let state = advanceStreak(EMPTY_STREAK, "2026-07-01");
    state = advanceStreak(state, "2026-07-02");
    state = advanceStreak(state, "2026-07-03");
    expect(state.currentStreak).toBe(3);

    const afterGap = advanceStreak(state, "2026-07-07");
    expect(afterGap.currentStreak).toBe(1);
    expect(afterGap.longestStreak).toBe(3);
    expect(afterGap.lastActionDate).toBe("2026-07-07");
  });

  test("month/year boundaries count as consecutive days", () => {
    const eoy = advanceStreak(EMPTY_STREAK, "2026-12-31");
    const nyd = advanceStreak(eoy, "2027-01-01");
    expect(nyd.currentStreak).toBe(2);
  });

  test("backdated completion never rewinds the streak", () => {
    const state = advanceStreak(EMPTY_STREAK, "2026-07-07");
    const backdated = advanceStreak(state, "2026-07-05");
    expect(backdated.lastActionDate).toBe("2026-07-07");
    expect(backdated.currentStreak).toBe(1);
  });

  test("invalid date throws", () => {
    expect(() => advanceStreak(EMPTY_STREAK, "July 7")).toThrowError("STREAK_INVALID_DATE");
  });
});

describe("effective streak for display", () => {
  test("alive when last check-in was today or yesterday", () => {
    const state = { currentStreak: 4, longestStreak: 6, lastActionDate: "2026-07-06" };
    expect(effectiveCurrentStreak(state, "2026-07-06")).toBe(4);
    expect(effectiveCurrentStreak(state, "2026-07-07")).toBe(4);
  });

  test("shows 0 once a day has been missed", () => {
    const state = { currentStreak: 4, longestStreak: 6, lastActionDate: "2026-07-04" };
    expect(effectiveCurrentStreak(state, "2026-07-07")).toBe(0);
  });

  test("no history -> 0", () => {
    expect(effectiveCurrentStreak(EMPTY_STREAK, "2026-07-07")).toBe(0);
  });
});

describe("dayDifference", () => {
  test("computes whole-day deltas", () => {
    expect(dayDifference("2026-07-01", "2026-07-07")).toBe(6);
    expect(dayDifference("2026-07-07", "2026-07-07")).toBe(0);
    expect(dayDifference("2026-07-07", "2026-07-01")).toBe(-6);
  });

  test("returns null for garbage", () => {
    expect(dayDifference("garbage", "2026-07-07")).toBeNull();
  });
});
