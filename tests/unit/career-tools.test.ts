import { describe, expect, test } from "vitest";
import { mapExperience, buildResumeEvidence, buildCareerPlan } from "@/lib/career-tools";

describe("career exercises", () => {
  test("does not assign capabilities from a title, an empty answer, or a negated task", () => {
    for (const text of ["", "Product manager", "I have never tested software", "I did not analyze reports", "I don't design prototypes"]) {
      expect(mapExperience(text)).toEqual([]);
    }
  });

  test("connects a possible direction to the actual reported task and leaves gaps unassessed", () => {
    const directions = mapExperience("I tested releases and documented reproducible bugs.\nI analyzed campaign reports.");
    const qa = directions.find((entry) => entry.id === "quality");
    expect(qa?.evidence[0]).toContain("tested releases");
    expect(qa?.gaps.length).toBeGreaterThan(0);
    expect(directions.some((entry) => entry.id === "analytics")).toBe(true);
    expect(mapExperience("I have never tested software. I designed prototypes.").map((entry) => entry.id)).toEqual(["design"]);
    expect(JSON.stringify(directions)).not.toContain("% fit");
  });

  test("does not turn a planned project into an employment accomplishment or invent a metric", () => {
    const input = { action: "Build a reply checker", output: "a synthetic test set", check: "manual review", evidence: "", status: "planned" as const };
    const draft = buildResumeEvidence(input);
    expect(draft).toContain("Planned project");
    expect(draft).toContain("Do not present this as completed work");
    expect(draft).not.toMatch(/improved|saved|reduced|\d+%/);
    const completed = buildResumeEvidence({ ...input, status: "completed", action: "Built a reply checker", evidence: "https://example.com/demo" });
    expect(completed).toContain("Independent project (self-reported)");
    expect(completed).toContain("https://example.com/demo");
    expect(completed).not.toContain("AI engineer");
  });

  test("requires concrete resume fields and uses selected direction and time in plans", () => {
    expect(buildResumeEvidence({ action: "", output: "", check: "", evidence: "", status: "completed" })).toBe("");
    const plan = buildCareerPlan("quality", "2", "proof");
    expect(plan).toContain("2 hours per week");
    expect(plan).toContain("synthetic");
    expect(plan).toContain("not a skill verification");
    expect(buildCareerPlan("design", "5", "reset")).toContain("current job descriptions");
    expect(buildCareerPlan("unknown", "5", "proof")).toBe("");
  });
});
