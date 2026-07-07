import { beforeEach, describe, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import type { DailyBriefing } from "@aitutor/daily-content";
import type { BriefingRescore } from "@aitutor/shared";
import type { AssessmentReport } from "../../apps/web/lib/assessment-report";
import {
  appendAssessmentReport,
  listAssessmentReportsForProfile,
  resetAnonymousAssessmentStateForTests,
} from "../../apps/web/lib/anonymous-assessment";
import { resetDailyBriefingStateForTests } from "../../apps/web/lib/daily-briefing-store";
import {
  completeDailyAction,
  getDailyAction,
  getDailyActionWithStreak,
  listCompletedDailyActionsSince,
  resetDailyActionStateForTests,
  runDailyRescoreForUser,
} from "../../apps/web/lib/daily-action";

const PROFILE_ID = "learner-profile-1";

const REPORT: AssessmentReport = {
  readinessScore: 52,
  headline: "Solid marketer, thin AI execution",
  summary: "Good fundamentals; automation gaps.",
  strengths: [{ title: "Channel depth", detail: "Knows the funnel." }],
  gaps: [
    { title: "Programmatic SEO automation", whyItMatters: "Manual SEO is being priced out.", marketImpact: "high" },
    { title: "AI copy evaluation", whyItMatters: "Volume without QA erodes brand.", marketImpact: "medium" },
  ],
  recommendedPath: { careerPathId: "marketing-seo", reason: "Closest fit." },
  thirtyDayPlan: [{ week: 1, focus: "Automate one page", actions: ["Ship one programmatic page"] }],
};

function fixtureBriefing(date = "2026-07-07"): DailyBriefing {
  return {
    careerPathId: "marketing-seo",
    careerPathName: "Marketing & SEO",
    date,
    dayOfWeek: 2,
    dowTheme: "Tool Tuesday",
    dowBlurb: "A tool worth trying today",
    topStory: {
      headline: "New bulk-content model ships",
      summary: "Automates long-form SEO content.",
      source: "TechCrunch AI",
      url: "https://real.example.com/top",
      trendingScore: 2,
      published: `${date}T09:00:00Z`,
    },
    quickHits: [],
    sources: [{ name: "TechCrunch AI", url: "https://real.example.com/top" }],
    toolOfTheDay: null,
    byTheNumbers: null,
    fetchedCount: 10,
    feedsOk: 9,
    feedsFail: 1,
    validated: true,
  };
}

function fixtureRescore(overrides: Partial<BriefingRescore> = {}): BriefingRescore {
  return {
    gapAdjustments: [
      {
        gapTitle: "Programmatic SEO automation",
        direction: "up",
        reason: "Bulk-content model raises urgency.",
      },
    ],
    scoreDelta: -1,
    scoreDeltaReason: "The release automates part of the role's core output.",
    dailyAction: {
      title: "Run one blog post through the new bulk-content workflow",
      minutes: 15,
      gapRef: "Programmatic SEO automation",
      artifactRef: null,
    },
    ...overrides,
  };
}

async function seedReport() {
  const anonymousAssessmentId = randomUUID();
  await appendAssessmentReport({
    anonymousAssessmentId,
    learnerProfileId: PROFILE_ID,
    readinessScore: 52,
    deterministicScore: 0.6,
    model: "gpt-4.1-mini",
    report: REPORT,
  });
  return anonymousAssessmentId;
}

describe("daily re-scoring + daily action (memory mode)", () => {
  beforeEach(() => {
    resetAnonymousAssessmentStateForTests();
    resetDailyBriefingStateForTests();
    resetDailyActionStateForTests();
  });

  test("no assessment report -> explicit failure, no fabricated action", async () => {
    const result = await runDailyRescoreForUser({
      learnerProfileId: PROFILE_ID,
      careerPathId: "marketing-seo",
      now: new Date("2026-07-07T11:00:00Z"),
      deps: { buildBriefing: async () => fixtureBriefing() },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("ASSESSMENT_REPORT_MISSING");
    expect(await getDailyAction({ learnerProfileId: PROFILE_ID, actionDate: "2026-07-07" })).toBeNull();
  });

  test("successful rescore persists the daily action and appends the score delta to history", async () => {
    await seedReport();
    let llmCalls = 0;

    const result = await runDailyRescoreForUser({
      learnerProfileId: PROFILE_ID,
      careerPathId: "marketing-seo",
      now: new Date("2026-07-07T11:00:00Z"),
      deps: {
        buildBriefing: async () => fixtureBriefing(),
        generateRescore: async () => {
          llmCalls += 1;
          return { rescore: fixtureRescore(), model: "gpt-4.1-mini" };
        },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.created).toBe(true);
      expect(result.action.title).toContain("bulk-content workflow");
      expect(result.action.minutes).toBe(15);
      expect(result.action.gapRef).toBe("Programmatic SEO automation");
      expect(result.action.status).toBe("pending");
      expect(result.scoreAfter).toBe(51);
    }
    expect(llmCalls).toBe(1);

    // History append: the score's spine grew by one row.
    const history = await listAssessmentReportsForProfile(PROFILE_ID);
    expect(history).toHaveLength(2);
    expect(history[1].readinessScore).toBe(51);
    const rescoreMeta = (history[1].report as unknown as Record<string, unknown>).rescore as Record<string, unknown>;
    expect(rescoreMeta.source).toBe("briefing_rescore");
    expect(rescoreMeta.scoreDelta).toBe(-1);
    expect(rescoreMeta.baseScore).toBe(52);
  });

  test("zero delta appends nothing to history", async () => {
    await seedReport();
    const result = await runDailyRescoreForUser({
      learnerProfileId: PROFILE_ID,
      careerPathId: "marketing-seo",
      now: new Date("2026-07-07T11:00:00Z"),
      deps: {
        buildBriefing: async () => fixtureBriefing(),
        generateRescore: async () => ({
          rescore: fixtureRescore({ scoreDelta: 0, scoreDeltaReason: "" }),
          model: "gpt-4.1-mini",
        }),
      },
    });
    expect(result.ok).toBe(true);
    expect(await listAssessmentReportsForProfile(PROFILE_ID)).toHaveLength(1);
  });

  test("idempotent per day: second run returns the existing action without a new LLM call", async () => {
    await seedReport();
    let llmCalls = 0;
    const deps = {
      buildBriefing: async () => fixtureBriefing(),
      generateRescore: async () => {
        llmCalls += 1;
        return { rescore: fixtureRescore(), model: "gpt-4.1-mini" };
      },
    };
    const now = new Date("2026-07-07T11:00:00Z");

    const first = await runDailyRescoreForUser({ learnerProfileId: PROFILE_ID, careerPathId: "marketing-seo", now, deps });
    const second = await runDailyRescoreForUser({ learnerProfileId: PROFILE_ID, careerPathId: "marketing-seo", now, deps });

    expect(first.ok && first.created).toBe(true);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.created).toBe(false);
    expect(llmCalls).toBe(1);
    // History was appended exactly once.
    expect(await listAssessmentReportsForProfile(PROFILE_ID)).toHaveLength(2);
  });

  test("LLM failure -> explicit error, nothing persisted (hard-failure contract)", async () => {
    await seedReport();
    const result = await runDailyRescoreForUser({
      learnerProfileId: PROFILE_ID,
      careerPathId: "marketing-seo",
      now: new Date("2026-07-07T11:00:00Z"),
      deps: {
        buildBriefing: async () => fixtureBriefing(),
        generateRescore: async () => {
          throw new Error("OPENAI_CONFIG_MISSING");
        },
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("OPENAI_CONFIG_MISSING");
    expect(await getDailyAction({ learnerProfileId: PROFILE_ID, actionDate: "2026-07-07" })).toBeNull();
    expect(await listAssessmentReportsForProfile(PROFILE_ID)).toHaveLength(1);
  });
});

describe("daily action completion + streaks (memory mode)", () => {
  beforeEach(() => {
    resetAnonymousAssessmentStateForTests();
    resetDailyBriefingStateForTests();
    resetDailyActionStateForTests();
  });

  async function runForDay(dayIso: string) {
    return runDailyRescoreForUser({
      learnerProfileId: PROFILE_ID,
      careerPathId: "marketing-seo",
      now: new Date(`${dayIso}T11:00:00Z`),
      deps: {
        buildBriefing: async () => fixtureBriefing(dayIso),
        generateRescore: async () => ({
          rescore: fixtureRescore({ scoreDelta: 0, scoreDeltaReason: "" }),
          model: "gpt-4.1-mini",
        }),
      },
    });
  }

  test("completing without an action fails explicitly", async () => {
    const result = await completeDailyAction({ learnerProfileId: PROFILE_ID, now: new Date("2026-07-07T18:00:00Z") });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("DAILY_ACTION_NOT_FOUND");
  });

  test("completion marks the action and starts a streak; re-completion is idempotent", async () => {
    await seedReport();
    await runForDay("2026-07-07");

    const completed = await completeDailyAction({ learnerProfileId: PROFILE_ID, now: new Date("2026-07-07T18:00:00Z") });
    expect(completed.ok).toBe(true);
    if (completed.ok) {
      expect(completed.action.status).toBe("completed");
      expect(completed.streak.currentStreak).toBe(1);
      expect(completed.alreadyCompleted).toBe(false);
    }

    const again = await completeDailyAction({ learnerProfileId: PROFILE_ID, now: new Date("2026-07-07T20:00:00Z") });
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.alreadyCompleted).toBe(true);
      expect(again.streak.currentStreak).toBe(1);
    }
  });

  test("consecutive days build the streak; a missed day resets it", async () => {
    await seedReport();
    for (const day of ["2026-07-07", "2026-07-08"]) {
      await runForDay(day);
      const completed = await completeDailyAction({ learnerProfileId: PROFILE_ID, now: new Date(`${day}T18:00:00Z`) });
      expect(completed.ok).toBe(true);
    }

    let view = await getDailyActionWithStreak({ learnerProfileId: PROFILE_ID, now: new Date("2026-07-08T20:00:00Z") });
    expect(view.streak.current).toBe(2);
    expect(view.streak.longest).toBe(2);

    // Miss 07-09, complete 07-10 -> reset to 1, longest preserved.
    await runForDay("2026-07-10");
    const afterGap = await completeDailyAction({ learnerProfileId: PROFILE_ID, now: new Date("2026-07-10T18:00:00Z") });
    expect(afterGap.ok).toBe(true);
    if (afterGap.ok) {
      expect(afterGap.streak.currentStreak).toBe(1);
      expect(afterGap.streak.longestStreak).toBe(2);
    }

    view = await getDailyActionWithStreak({ learnerProfileId: PROFILE_ID, now: new Date("2026-07-10T20:00:00Z") });
    expect(view.streak.current).toBe(1);
    expect(view.streak.longest).toBe(2);
  });

  test("completed actions are queryable for the weekly report window", async () => {
    await seedReport();
    for (const day of ["2026-07-06", "2026-07-07"]) {
      await runForDay(day);
      await completeDailyAction({ learnerProfileId: PROFILE_ID, now: new Date(`${day}T18:00:00Z`) });
    }
    const completed = await listCompletedDailyActionsSince({ learnerProfileId: PROFILE_ID, sinceDate: "2026-07-07" });
    expect(completed).toHaveLength(1);
    expect(completed[0].actionDate).toBe("2026-07-07");
  });
});
