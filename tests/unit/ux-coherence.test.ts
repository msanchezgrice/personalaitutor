import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { AssessmentReport, ThirtyDayPlanWeek } from "@aitutor/shared";
import { buildDashboardGamification } from "@aitutor/shared";
import { buildStarterProjectSeed } from "@/lib/plan-progress";

/**
 * A+B. Naming collision + cross-surface status coherence.
 * - Starter project titles are plan/outcome-oriented and never identical to
 *   (or a superset of) one of the path's module names.
 * - Module names get a "Module" qualifier wherever they could read as
 *   project titles (home cards/skill rows, projects page, hydrator).
 * - Status/progress numbers derive from the same state the workbench uses
 *   (project.state + module steps), not hard-coded percentages.
 * - XP totals visibly reconcile (achievements + activity breakdown), and the
 *   badge empty-copy never renders as if nothing is unlocked when
 *   achievements are unlocked.
 */

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function report(plan: ThirtyDayPlanWeek[]): AssessmentReport {
  return {
    readinessScore: 55,
    headline: "Strong PM instincts, thin AI reps",
    summary: "Summary.",
    strengths: [{ title: "Role depth", detail: "Knows the craft." }],
    gaps: [{ title: "No shipped research artifacts", whyItMatters: "Proof gap.", marketImpact: "high" }],
    recommendedPath: { careerPathId: "product-management", reason: "Direct fit." },
    thirtyDayPlan: plan,
  };
}

describe("starter project seed naming", () => {
  test("keeps plan-oriented Week 1 titles when the focus is distinct from module names", () => {
    const seed = buildStarterProjectSeed({
      careerPathName: "Product Management",
      report: report([
        { week: 1, focus: "Automate one recurring PRD workflow", moduleTitle: "PRD Generation", actions: ["a"] },
      ]),
    });
    expect(seed.title).toBe("Week 1: Automate one recurring PRD workflow");
  });

  test("never titles a project identically to (or as a superset of) a module name", () => {
    const seed = buildStarterProjectSeed({
      careerPathName: "Product Management",
      report: report([
        { week: 1, focus: "Synthetic User Research", moduleTitle: "Synthetic User Research", actions: ["a"] },
        { week: 2, focus: "Wireframe with AI", moduleTitle: "AI Wireframing", actions: ["b"] },
      ]),
    });
    expect(seed.title.toLowerCase()).not.toContain("synthetic user research");
    expect(seed.title).toContain("Week 1:");
    // Outcome-oriented replacement references the top gap.
    expect(seed.title).toContain("No shipped research artifacts");
  });
});

describe("legacy client-side project naming (gemini-runtime)", () => {
  const runtime = read("apps/web/public/gemini-runtime.js");

  test("the legacy hydrator can no longer mint module-name-derived project titles", () => {
    expect(runtime).not.toContain('recommendation.title + " Starter Build"');
  });

  test("home skill pills no longer show the static skill.score percent", () => {
    expect(runtime).not.toContain('" (" + Math.round((skill.score');
  });

  test("home module recommendation pills carry the Module qualifier", () => {
    expect(runtime).toContain("Module (Start here)");
  });

  test("projects banner progress derives from module steps, not build-log length", () => {
    expect(runtime).not.toContain("active.buildLog.length * 12");
    expect(runtime).toContain("moduleStepProgressPct");
  });
});

describe("projects page status coherence", () => {
  const source = read("apps/web/app/dashboard/projects/page.tsx");

  test("status pill uses the real project state (same field as the public profile)", () => {
    expect(source).toContain("prettyProjectState");
    expect(source).not.toContain('{activeProject ? "Active" : "Planned"}');
  });

  test("progress percent derives from module steps, not hard-coded 20%/10%", () => {
    expect(source).not.toContain('"20%" : "10%"');
    expect(source).not.toContain('{activeProject ? "20%" : "10%"}');
    expect(source).toContain("activeProgressPct");
  });

  test("module fallback titles are qualified and cards carry a module chip", () => {
    expect(source).toContain("Module:");
  });
});

describe("home page status coherence", () => {
  const source = read("apps/web/app/dashboard/page.tsx");

  test("active card progress derives from module steps, not a fixed 20% bar", () => {
    expect(source).not.toContain("w-[20%]");
    expect(source).toContain("activeProgressPct");
  });

  test("module recommendation fallbacks carry the Module qualifier", () => {
    expect(source).toContain("Module (Start here)");
    expect(source).toContain("Module: ${topRecommendation.title}");
  });

  test("badge empty-copy is conditional on unlocked achievements", () => {
    expect(source).toContain("unlockedAchievements.length");
    expect(source).toContain("badges unlock at bigger milestones");
  });

  test("XP total shows a reconciling breakdown", () => {
    expect(source).toContain("xpBreakdown");
  });
});

describe("public profile project cards", () => {
  const source = read("apps/web/app/u/[handle]/page.tsx");

  test("project cards list their module chip when a module session exists", () => {
    expect(source).toContain("Module:");
    expect(source).toContain("getTutorSessionForProject");
  });
});

describe("gamification XP breakdown", () => {
  test("achievements + activity always sum to xpTotal", () => {
    const now = "2026-07-08T12:00:00.000Z";
    const gamification = buildDashboardGamification({
      user: {
        id: "u1",
        name: "Test",
        headline: "PM",
        avatarUrl: null,
        handle: "test",
        published: false,
        careerPathId: "product-management",
        goals: ["upskill_current_job"],
        tools: [],
        skills: [],
        socialLinks: {},
        contactEmail: null,
        createdAt: now,
        updatedAt: now,
      } as never,
      projects: [],
      latestEvents: [],
      hasOnboardingSession: true,
      onboardingStartedAt: now,
      hasCompletedAssessment: true,
      assessmentSubmittedAt: now,
      hasSocialDraft: false,
      socialDraftCreatedAt: null,
      activity: {
        dailyActionsCompleted: 3,
        tutorSessionsCompleted: 1,
        tutorSessionsStarted: 1,
        streakCurrent: 3,
        streakLongest: 3,
        streakLastActionDate: "2026-07-08",
      },
    } as never);

    expect(gamification.xpBreakdown.achievements + gamification.xpBreakdown.activity).toBe(
      gamification.xpTotal,
    );
    // 3 daily actions (+30) + 1 completed session (+25) + first session (+10).
    expect(gamification.xpBreakdown.activity).toBe(65);
    expect(gamification.xpBreakdown.achievements).toBeGreaterThan(0);
  });
});
