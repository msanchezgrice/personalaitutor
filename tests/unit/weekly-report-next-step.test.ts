import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { deriveWeeklyNextStep } from "../../apps/web/lib/weekly-report";

describe("weekly report nextStep anchors to the 30-day plan (spine phase 4)", () => {
  test("plan week with a module -> anchored to the week focus + module tutor session", () => {
    const nextStep = deriveWeeklyNextStep({
      planProgress: {
        currentWeek: 2,
        totalWeeks: 4,
        currentEntry: {
          week: 2,
          focus: "Synthetic user research reps",
          actions: ["Run one AI-led synthesis"],
          moduleTitle: "Synthetic User Research",
        },
        moduleTitle: "Synthetic User Research",
      },
      topOpenGapTitle: "No automated PRD workflow",
    });
    expect(nextStep).toContain("Week 2 of 4");
    expect(nextStep).toContain("Synthetic user research reps");
    expect(nextStep).toContain('"Synthetic User Research" tutor session');
  });

  test("legacy plan week without a module -> anchored to the focus and its first action", () => {
    const nextStep = deriveWeeklyNextStep({
      planProgress: {
        currentWeek: 3,
        totalWeeks: 4,
        currentEntry: { week: 3, focus: "Verification habits", actions: ["Create an output review checklist"] },
        moduleTitle: null,
      },
      topOpenGapTitle: null,
    });
    expect(nextStep).toContain("Week 3 of 4");
    expect(nextStep).toContain("Verification habits");
    expect(nextStep).toContain("Create an output review checklist");
  });

  test("no plan -> falls back to the existing gap-based next step", () => {
    const nextStep = deriveWeeklyNextStep({
      planProgress: null,
      topOpenGapTitle: "AI copy evaluation",
    });
    expect(nextStep).toBe(
      'Close "AI copy evaluation" — start its tutor session and finish with a generated artifact.',
    );
  });

  test("no plan and no open gap -> generic module nudge (unchanged behavior)", () => {
    const nextStep = deriveWeeklyNextStep({ planProgress: null, topOpenGapTitle: null });
    expect(nextStep).toBe(
      "Pick the next module in your path and run its tutor session to keep the score climbing.",
    );
  });

  test("computeWeeklyReportContext derives nextStep through the plan-aware helper", () => {
    const source = readFileSync(path.resolve(process.cwd(), "apps/web/lib/weekly-report.ts"), "utf8");
    expect(source).toContain("deriveWeeklyNextStep");
    expect(source).toContain("getPlanProgressForProfile");
  });
});
