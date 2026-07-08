import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, test } from "vitest";
import { buildRecommendedModuleGuide } from "@aitutor/shared";
import type { AssessmentReport } from "../../apps/web/lib/assessment-report";
import {
  appendAssessmentReport,
  resetAnonymousAssessmentStateForTests,
} from "../../apps/web/lib/anonymous-assessment";
import {
  completeTutorSession,
  completeTutorSessionStep,
  listCompletedTutorSessionModuleTitles,
  resetTutorSessionStateForTests,
  setTutorChecklistItem,
  startTutorSession,
} from "../../apps/web/lib/tutor-session";
import {
  buildStarterProjectSeed,
  computeCurrentPlanWeek,
  computePlanProgress,
  getPlanModuleTitlesForProfile,
  getPlanProgressForProfile,
  getStarterProjectSeedForProfile,
  getWeeklyFocusCard,
  type ThirtyDayPlanWeek,
} from "../../apps/web/lib/plan-progress";

const PROFILE_ID = "learner-profile-plan";

const PLAN: ThirtyDayPlanWeek[] = [
  {
    week: 1,
    focus: "Automate one recurring PRD workflow",
    moduleTitle: "PRD Generation",
    actions: ["Pick one weekly doc", "Build a prompt pack"],
  },
  {
    week: 2,
    focus: "Synthetic user research reps",
    moduleTitle: "Synthetic User Research",
    actions: ["Run one AI-led synthesis"],
  },
  { week: 3, focus: "Wireframe with AI", moduleTitle: "AI Wireframing", actions: ["Draft one flow"] },
  { week: 4, focus: "Ship visible proof", moduleTitle: "Sentiment Analysis", actions: ["Publish one case study"] },
];

function pmReport(plan: ThirtyDayPlanWeek[] = PLAN): AssessmentReport {
  return {
    readinessScore: 55,
    headline: "Strong PM instincts, thin AI reps",
    summary: "Summary.",
    strengths: [{ title: "Role depth", detail: "Knows the craft." }],
    gaps: [
      { title: "No automated PRD workflow", whyItMatters: "The market expects it.", marketImpact: "high" },
      { title: "Limited verification habits", whyItMatters: "Trust erodes.", marketImpact: "medium" },
    ],
    recommendedPath: { careerPathId: "product-management", reason: "Direct fit." },
    thirtyDayPlan: plan,
  };
}

async function seedReport(plan: ThirtyDayPlanWeek[] = PLAN, profileId = PROFILE_ID) {
  const anonymousAssessmentId = randomUUID();
  await appendAssessmentReport({
    anonymousAssessmentId,
    learnerProfileId: profileId,
    readinessScore: 55,
    deterministicScore: 0.5,
    model: "gpt-4.1-mini",
    report: pmReport(plan),
  });
  return anonymousAssessmentId;
}

async function completeModuleSession(moduleTitle: string, profileId = PROFILE_ID) {
  const guide = buildRecommendedModuleGuide({
    careerPathId: "product-management",
    moduleTitle,
    jobTitle: "Senior PM",
    primaryGoal: "upskill_current_job",
  });
  const session = await startTutorSession({
    projectId: `project-${moduleTitle.replace(/\s+/g, "-").toLowerCase()}`,
    learnerProfileId: profileId,
    guide,
  });
  for (const step of session.steps) {
    await completeTutorSessionStep({
      sessionId: session.id,
      learnerProfileId: profileId,
      stepIndex: step.index,
      evidenceNote: "done",
    });
  }
  for (const item of session.checklist) {
    await setTutorChecklistItem({
      sessionId: session.id,
      learnerProfileId: profileId,
      itemIndex: item.index,
      done: true,
      evidence: "proof",
    });
  }
  const result = await completeTutorSession({ sessionId: session.id, learnerProfileId: profileId });
  if (!result.ok) throw new Error("TEST_SESSION_COMPLETE_FAILED");
}

function daysAgoIso(days: number, from = new Date("2026-07-07T12:00:00Z")) {
  return new Date(from.getTime() - days * 86_400_000).toISOString();
}

const NOW = new Date("2026-07-07T12:00:00Z");

describe("computeCurrentPlanWeek (pure)", () => {
  test("fresh report -> week 1", () => {
    expect(
      computeCurrentPlanWeek({ plan: PLAN, planCreatedAt: daysAgoIso(0), now: NOW }),
    ).toBe(1);
  });

  test("8-day-old report -> week 2", () => {
    expect(
      computeCurrentPlanWeek({ plan: PLAN, planCreatedAt: daysAgoIso(8), now: NOW }),
    ).toBe(2);
  });

  test("5-weeks-old report clamps to week 4", () => {
    expect(
      computeCurrentPlanWeek({ plan: PLAN, planCreatedAt: daysAgoIso(36), now: NOW }),
    ).toBe(4);
  });

  test("unparseable createdAt falls back to week 1", () => {
    expect(computeCurrentPlanWeek({ plan: PLAN, planCreatedAt: "not-a-date", now: NOW })).toBe(1);
  });

  test("completed module sessions advance a fresh report past week 1", () => {
    expect(
      computeCurrentPlanWeek({
        plan: PLAN,
        planCreatedAt: daysAgoIso(0),
        now: NOW,
        completedModuleTitles: ["PRD Generation", "Synthetic User Research"],
      }),
    ).toBe(3);
  });

  test("module-title matching for session advance is case-insensitive", () => {
    expect(
      computeCurrentPlanWeek({
        plan: PLAN,
        planCreatedAt: daysAgoIso(0),
        now: NOW,
        completedModuleTitles: ["prd generation"],
      }),
    ).toBe(2);
  });

  test("all plan modules completed clamps to the final week", () => {
    expect(
      computeCurrentPlanWeek({
        plan: PLAN,
        planCreatedAt: daysAgoIso(0),
        now: NOW,
        completedModuleTitles: PLAN.map((week) => week.moduleTitle!) ,
      }),
    ).toBe(4);
  });

  test("report age wins when it is further along than session progress", () => {
    expect(
      computeCurrentPlanWeek({
        plan: PLAN,
        planCreatedAt: daysAgoIso(15),
        now: NOW,
        completedModuleTitles: ["PRD Generation"],
      }),
    ).toBe(3);
  });
});

describe("computePlanProgress (pure)", () => {
  test("anchors week math on the original report row, not the latest rescore append", () => {
    const assessmentId = randomUUID();
    const progress = computePlanProgress({
      history: [
        { anonymousAssessmentId: assessmentId, createdAt: daysAgoIso(15), report: pmReport() },
        // Daily rescore rows copy the plan forward with a fresh createdAt.
        { anonymousAssessmentId: assessmentId, createdAt: daysAgoIso(0), report: pmReport() },
      ],
      completedModuleTitles: [],
      now: NOW,
    });
    expect(progress?.currentWeek).toBe(3);
    expect(progress?.planCreatedAt).toBe(daysAgoIso(15));
  });

  test("a retake (new assessment id) resets the anchor to the retake date", () => {
    const progress = computePlanProgress({
      history: [
        { anonymousAssessmentId: "assessment-a", createdAt: daysAgoIso(30), report: pmReport() },
        { anonymousAssessmentId: "assessment-b", createdAt: daysAgoIso(1), report: pmReport() },
      ],
      completedModuleTitles: [],
      now: NOW,
    });
    expect(progress?.currentWeek).toBe(1);
    expect(progress?.planCreatedAt).toBe(daysAgoIso(1));
  });

  test("old reports without moduleTitle stay supported: null modules, no completion", () => {
    const legacyPlan: ThirtyDayPlanWeek[] = PLAN.map(({ week, focus, actions }) => ({ week, focus, actions }));
    const progress = computePlanProgress({
      history: [{ anonymousAssessmentId: "legacy", createdAt: daysAgoIso(8), report: pmReport(legacyPlan) }],
      completedModuleTitles: ["PRD Generation"],
      now: NOW,
    });
    expect(progress?.currentWeek).toBe(2);
    expect(progress?.moduleTitle).toBeNull();
    expect(progress?.weeks.every((week) => week.moduleTitle === null && !week.completed)).toBe(true);
  });

  test("returns null when the plan is empty", () => {
    expect(
      computePlanProgress({
        history: [{ anonymousAssessmentId: "x", createdAt: daysAgoIso(0), report: pmReport([]) }],
        completedModuleTitles: [],
        now: NOW,
      }),
    ).toBeNull();
  });
});

describe("getPlanProgressForProfile (memory mode)", () => {
  beforeEach(() => {
    resetAnonymousAssessmentStateForTests();
    resetTutorSessionStateForTests();
  });

  test("no linked report -> null", async () => {
    expect(await getPlanProgressForProfile(PROFILE_ID)).toBeNull();
  });

  test("fresh report -> week 1 with the plan's week-1 module", async () => {
    await seedReport();
    const progress = await getPlanProgressForProfile(PROFILE_ID);
    expect(progress?.currentWeek).toBe(1);
    expect(progress?.totalWeeks).toBe(4);
    expect(progress?.moduleTitle).toBe("PRD Generation");
    expect(progress?.currentEntry.focus).toBe("Automate one recurring PRD workflow");
    expect(progress?.weeks).toHaveLength(4);
    expect(progress?.weeks[0]).toMatchObject({ week: 1, isCurrent: true, completed: false });
  });

  test("completing week 1's module session advances to week 2 and marks week 1 done", async () => {
    await seedReport();
    await completeModuleSession("PRD Generation");

    const progress = await getPlanProgressForProfile(PROFILE_ID);
    expect(progress?.currentWeek).toBe(2);
    expect(progress?.moduleTitle).toBe("Synthetic User Research");
    expect(progress?.weeks[0]).toMatchObject({ completed: true, isCurrent: false });
    expect(progress?.weeks[1]).toMatchObject({ completed: false, isCurrent: true });
  });

  test("a far-future now clamps to the final week", async () => {
    await seedReport();
    const progress = await getPlanProgressForProfile(
      PROFILE_ID,
      new Date(Date.now() + 60 * 86_400_000),
    );
    expect(progress?.currentWeek).toBe(4);
    expect(progress?.moduleTitle).toBe("Sentiment Analysis");
  });

  test("getPlanModuleTitlesForProfile returns the plan-ordered module titles ([] without a report)", async () => {
    expect(await getPlanModuleTitlesForProfile(PROFILE_ID)).toEqual([]);
    await seedReport();
    expect(await getPlanModuleTitlesForProfile(PROFILE_ID)).toEqual([
      "PRD Generation",
      "Synthetic User Research",
      "AI Wireframing",
      "Sentiment Analysis",
    ]);
  });
});

describe("listCompletedTutorSessionModuleTitles (memory mode)", () => {
  beforeEach(() => {
    resetTutorSessionStateForTests();
  });

  test("returns [] with no sessions and ignores active sessions", async () => {
    expect(await listCompletedTutorSessionModuleTitles(PROFILE_ID)).toEqual([]);
    const guide = buildRecommendedModuleGuide({
      careerPathId: "product-management",
      moduleTitle: "AI Wireframing",
      jobTitle: "PM",
      primaryGoal: "upskill_current_job",
    });
    await startTutorSession({ projectId: "project-active", learnerProfileId: PROFILE_ID, guide });
    expect(await listCompletedTutorSessionModuleTitles(PROFILE_ID)).toEqual([]);
  });

  test("returns completed session module titles", async () => {
    await completeModuleSession("PRD Generation");
    expect(await listCompletedTutorSessionModuleTitles(PROFILE_ID)).toEqual(["PRD Generation"]);
  });
});

describe("starter project seed", () => {
  beforeEach(() => {
    resetAnonymousAssessmentStateForTests();
    resetTutorSessionStateForTests();
  });

  test("no report keeps the current generic starter copy", () => {
    const seed = buildStarterProjectSeed({ careerPathName: "Product Management", report: null });
    expect(seed.title).toBe("Product Management Starter Build");
    expect(seed.description).toBe(
      "Starter project generated from your Product Management path to begin collecting proof artifacts.",
    );
  });

  test("no report and no career path keeps the generic fallback", () => {
    const seed = buildStarterProjectSeed({ careerPathName: null, report: null });
    expect(seed.title).toBe("AI Starter Build");
    expect(seed.description).toBe(
      "Starter project generated from onboarding to begin collecting proof artifacts.",
    );
  });

  test("linked report seeds title/description from plan week 1 focus + top gap", () => {
    const report = pmReport();
    const seed = buildStarterProjectSeed({ careerPathName: "Product Management", report });
    expect(seed.title).toContain("Automate one recurring PRD workflow");
    expect(seed.description).toContain("Automate one recurring PRD workflow");
    expect(seed.description).toContain("No automated PRD workflow");
    expect(seed.description).toContain("PRD Generation");
  });

  test("getStarterProjectSeedForProfile picks personalized copy only when a report is linked", async () => {
    const generic = await getStarterProjectSeedForProfile({
      learnerProfileId: PROFILE_ID,
      careerPathName: "Product Management",
    });
    expect(generic.title).toBe("Product Management Starter Build");

    await seedReport();
    const personalized = await getStarterProjectSeedForProfile({
      learnerProfileId: PROFILE_ID,
      careerPathName: "Product Management",
    });
    expect(personalized.title).toContain("Automate one recurring PRD workflow");
  });
});

describe("getWeeklyFocusCard (memory mode)", () => {
  beforeEach(() => {
    resetAnonymousAssessmentStateForTests();
    resetTutorSessionStateForTests();
  });

  test("null when the user has no linked report", async () => {
    expect(await getWeeklyFocusCard(PROFILE_ID)).toBeNull();
  });

  test("returns the current week's focus, actions, module, and week tracker", async () => {
    await seedReport();
    await completeModuleSession("PRD Generation");

    const card = await getWeeklyFocusCard(PROFILE_ID);
    expect(card).toBeTruthy();
    expect(card?.currentWeek).toBe(2);
    expect(card?.totalWeeks).toBe(4);
    expect(card?.focus).toBe("Synthetic user research reps");
    expect(card?.actions).toEqual(["Run one AI-led synthesis"]);
    expect(card?.moduleTitle).toBe("Synthetic User Research");
    expect(card?.weeks).toEqual([
      { week: 1, completed: true, isCurrent: false },
      { week: 2, completed: false, isCurrent: true },
      { week: 3, completed: false, isCurrent: false },
      { week: 4, completed: false, isCurrent: false },
    ]);
  });
});

describe("plan spine wiring (source checks)", () => {
  const read = (relative: string) => readFileSync(path.resolve(process.cwd(), relative), "utf8");

  test("projects page selects the active module from the plan's current week", () => {
    const source = read("apps/web/app/dashboard/projects/page.tsx");
    expect(source).toContain("getPlanProgressForProfile");
    expect(source).toContain("planProgress?.moduleTitle");
  });

  test("runtime orders module recommendations by plan and seeds the starter from it", () => {
    const source = read("apps/web/lib/runtime.ts");
    expect(source).toContain("orderModuleTracksByPlan");
    expect(source).toContain("getStarterProjectSeedForProfile");
    expect(source).toContain("getPlanModuleTitlesForProfile");
  });

  test("tutor-session start/drift routes resolve the plan-aware active module", () => {
    const source = read("apps/web/app/api/projects/[id]/tutor-session/route.ts");
    expect(source).toContain("resolveActiveModuleGuideForProfile");
  });
});
