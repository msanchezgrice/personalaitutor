import { beforeEach, describe, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import type { DailyBriefing } from "@aitutor/daily-content";
import type { BriefingRescore } from "@aitutor/shared";
import { buildRecommendedModuleGuide } from "@aitutor/shared";
import { createUser, getDashboardSummary, resetStateForTests } from "../../packages/shared/src/store";
import type { AssessmentReport } from "../../apps/web/lib/assessment-report";
import { appendAssessmentReport, resetAnonymousAssessmentStateForTests } from "../../apps/web/lib/anonymous-assessment";
import { resetDailyBriefingStateForTests } from "../../apps/web/lib/daily-briefing-store";
import {
  completeDailyAction,
  countCompletedDailyActions,
  resetDailyActionStateForTests,
  runDailyRescoreForUser,
} from "../../apps/web/lib/daily-action";
import {
  completeTutorSession,
  completeTutorSessionStep,
  countTutorSessionMilestones,
  setTutorChecklistItem,
  resetTutorSessionStateForTests,
  startTutorSession,
} from "../../apps/web/lib/tutor-session";
import { collectGamificationActivitySignals } from "../../apps/web/lib/gamification-signals";

const PROFILE_ID = "learner-profile-signals";

const REPORT: AssessmentReport = {
  readinessScore: 50,
  headline: "Ready to build",
  summary: "Baseline.",
  strengths: [{ title: "Domain depth", detail: "Knows the role." }],
  gaps: [{ title: "AI workflow reps", whyItMatters: "Practice gap.", marketImpact: "high" }],
  recommendedPath: { careerPathId: "marketing-seo", reason: "Closest fit." },
  thirtyDayPlan: [{ week: 1, focus: "One rep", actions: ["Do one rep"] }],
};

function fixtureBriefing(date: string): DailyBriefing {
  return {
    careerPathId: "marketing-seo",
    careerPathName: "Marketing & SEO",
    date,
    dayOfWeek: 2,
    dowTheme: "Theme",
    dowBlurb: "Blurb",
    topStory: {
      headline: "Story",
      summary: "Summary.",
      source: "Source",
      url: "https://real.example.com/top",
      trendingScore: 1,
      published: `${date}T09:00:00Z`,
    },
    quickHits: [],
    sources: [{ name: "Source", url: "https://real.example.com/top" }],
    toolOfTheDay: null,
    byTheNumbers: null,
    fetchedCount: 10,
    feedsOk: 9,
    feedsFail: 1,
    validated: true,
  };
}

const RESCORE: BriefingRescore = {
  gapAdjustments: [],
  scoreDelta: 0,
  scoreDeltaReason: "",
  dailyAction: { title: "Do the rep", minutes: 15, gapRef: "AI workflow reps", artifactRef: null },
};

async function completeActionOn(dateIso: string) {
  const now = new Date(dateIso);
  const run = await runDailyRescoreForUser({
    learnerProfileId: PROFILE_ID,
    careerPathId: "marketing-seo",
    now,
    deps: {
      buildBriefing: async () => fixtureBriefing(dateIso.slice(0, 10)),
      generateRescore: async () => ({ rescore: RESCORE, model: "gpt-4.1-mini" }),
    },
  });
  expect(run.ok).toBe(true);
  const completion = await completeDailyAction({ learnerProfileId: PROFILE_ID, now });
  expect(completion.ok).toBe(true);
}

const guide = buildRecommendedModuleGuide({
  careerPathId: "marketing-seo",
  moduleTitle: "AI Keyword Clustering",
  jobTitle: "Growth Manager",
  primaryGoal: "upskill_current_job",
});

async function runFullTutorSession(projectId: string) {
  const session = await startTutorSession({ projectId, learnerProfileId: PROFILE_ID, guide });
  for (const step of session.steps) {
    await completeTutorSessionStep({ sessionId: session.id, learnerProfileId: PROFILE_ID, stepIndex: step.index, evidenceNote: "done" });
  }
  for (const item of session.checklist) {
    await setTutorChecklistItem({ sessionId: session.id, learnerProfileId: PROFILE_ID, itemIndex: item.index, done: true, evidence: "pasted" });
  }
  const completed = await completeTutorSession({ sessionId: session.id, learnerProfileId: PROFILE_ID });
  expect(completed.ok).toBe(true);
  return session;
}

async function seedReport() {
  await appendAssessmentReport({
    anonymousAssessmentId: randomUUID(),
    learnerProfileId: PROFILE_ID,
    readinessScore: 50,
    deterministicScore: 0.5,
    model: "gpt-4.1-mini",
    report: REPORT,
  });
}

describe("gamification activity signal collection (memory mode)", () => {
  beforeEach(() => {
    resetStateForTests();
    resetAnonymousAssessmentStateForTests();
    resetDailyBriefingStateForTests();
    resetDailyActionStateForTests();
    resetTutorSessionStateForTests();
  });

  test("new learner has all-zero activity signals", async () => {
    const signals = await collectGamificationActivitySignals(PROFILE_ID);
    expect(signals).toMatchObject({
      dailyActionsCompleted: 0,
      streakCurrent: 0,
      streakLongest: 0,
      tutorSessionsStarted: 0,
      tutorSessionsCompleted: 0,
    });
  });

  test("counts completed daily actions and the live streak", async () => {
    await seedReport();
    await completeActionOn("2026-07-06T12:00:00Z");
    await completeActionOn("2026-07-07T12:00:00Z");

    expect(await countCompletedDailyActions(PROFILE_ID)).toBe(2);

    const signals = await collectGamificationActivitySignals(PROFILE_ID, new Date("2026-07-07T18:00:00Z"));
    expect(signals.dailyActionsCompleted).toBe(2);
    expect(signals.streakCurrent).toBe(2);
    expect(signals.streakLongest).toBe(2);
    expect(signals.streakLastActionDate).toBe("2026-07-07");
  });

  test("a stale streak reports zero current but keeps the longest", async () => {
    await seedReport();
    await completeActionOn("2026-07-01T12:00:00Z");

    const signals = await collectGamificationActivitySignals(PROFILE_ID, new Date("2026-07-07T18:00:00Z"));
    expect(signals.dailyActionsCompleted).toBe(1);
    expect(signals.streakCurrent).toBe(0);
    expect(signals.streakLongest).toBe(1);
  });

  test("counts tutor sessions started and completed with the first completion time", async () => {
    const started = await startTutorSession({ projectId: "project-a", learnerProfileId: PROFILE_ID, guide });
    expect(started.status).toBe("active");

    let milestones = await countTutorSessionMilestones(PROFILE_ID);
    expect(milestones).toMatchObject({ started: 1, completed: 0, firstCompletedAt: null });

    await runFullTutorSession("project-b");
    milestones = await countTutorSessionMilestones(PROFILE_ID);
    expect(milestones.started).toBe(2);
    expect(milestones.completed).toBe(1);
    expect(milestones.firstCompletedAt).toBeTruthy();

    const signals = await collectGamificationActivitySignals(PROFILE_ID);
    expect(signals.tutorSessionsStarted).toBe(2);
    expect(signals.tutorSessionsCompleted).toBe(1);
    expect(signals.firstTutorSessionCompletedAt).toBe(milestones.firstCompletedAt);
  });

  test("memory-mode dashboard summary reflects activity XP when signals are passed through", async () => {
    const user = createUser({ handleBase: "signals-user", name: "Signals User" });
    const withoutActivity = getDashboardSummary(user.id);
    const withActivity = getDashboardSummary(user.id, {
      dailyActionsCompleted: 5,
      streakCurrent: 5,
      streakLongest: 5,
      tutorSessionsStarted: 1,
      tutorSessionsCompleted: 1,
      firstTutorSessionCompletedAt: "2026-07-06T12:00:00.000Z",
    });
    expect(withoutActivity?.gamification.xpTotal ?? 0).toBeLessThan(withActivity?.gamification.xpTotal ?? 0);
    expect((withActivity?.gamification.xpTotal ?? 0) - (withoutActivity?.gamification.xpTotal ?? 0)).toBe(145);
    expect(withActivity?.gamification.achievements.some((entry) => entry.key === "tutor_session_completed" && entry.unlocked)).toBe(true);
  });
});
