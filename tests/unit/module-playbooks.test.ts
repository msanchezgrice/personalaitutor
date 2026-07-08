import { describe, expect, test } from "vitest";
import { buildRecommendedModuleGuide, CAREER_PATHS } from "@aitutor/shared";

/**
 * Rebuilt playbooks for the product-management and marketing-seo paths
 * (dashboard batch item 3): every module session is a sequence of actions
 * performed inside an AI tool with a copy-pasteable prompt embedded in the
 * step text, produces pasteable evidence, and ends in artifact generation.
 * Other career paths keep their original templates.
 */

const REWRITTEN_PATHS = ["product-management", "marketing-seo"] as const;

const pathModules = (pathId: string) =>
  CAREER_PATHS.find((path) => path.id === pathId)?.modules ?? [];

function guideFor(careerPathId: string, moduleTitle: string) {
  return buildRecommendedModuleGuide({
    careerPathId,
    moduleTitle,
    jobTitle: "Working Professional",
    primaryGoal: "upskill_current_job",
  });
}

// A "copy-pasteable prompt" = a double-quoted block of at least 60 characters.
const EMBEDDED_PROMPT = /"[^"]{60,}"/;
const BANNED_STEP_CONTENT = /\binstall\b|set up your (environment|machine|local)|environment setup|sign up for|create an account|pip |npm |terminal|command line/i;
const STEP_MINUTES = /\((\d+) min\)/;

describe("rewritten AI-tool playbooks (product-management, marketing-seo)", () => {
  for (const pathId of REWRITTEN_PATHS) {
    const modules = pathModules(pathId);

    test(`${pathId} has modules to rewrite`, () => {
      expect(modules.length).toBeGreaterThanOrEqual(3);
    });

    for (const moduleTitle of modules) {
      describe(`${pathId} / ${moduleTitle}`, () => {
        const guide = guideFor(pathId, moduleTitle);

        test("session has 4-6 steps", () => {
          expect(guide.steps.length).toBeGreaterThanOrEqual(4);
          expect(guide.steps.length).toBeLessThanOrEqual(6);
        });

        test("session is a distinct module playbook, not the generic path template", () => {
          const other = modules.find((entry) => entry !== moduleTitle);
          if (!other) return;
          const otherGuide = guideFor(pathId, other);
          expect(guide.steps.join("\n")).not.toBe(otherGuide.steps.join("\n"));
        });

        test("at least 3 steps embed a copy-pasteable prompt", () => {
          const withPrompts = guide.steps.filter((step) => EMBEDDED_PROMPT.test(step));
          expect(withPrompts.length).toBeGreaterThanOrEqual(3);
        });

        test("no environment-setup / install / signup boilerplate", () => {
          for (const step of guide.steps) {
            expect(step).not.toMatch(BANNED_STEP_CONTENT);
          }
        });

        test("every step before the final one produces pasteable evidence", () => {
          for (const step of guide.steps.slice(0, -1)) {
            expect(step).toMatch(/paste|copy|save|attach|evidence|capture/i);
          }
        });

        test("session ends in artifact generation", () => {
          expect(guide.steps[guide.steps.length - 1]).toMatch(/artifact/i);
        });

        test("session totals roughly 45 minutes", () => {
          const minutes = guide.steps.map((step) => {
            const match = STEP_MINUTES.exec(step);
            expect(match, `step has a minutes hint: ${step.slice(0, 80)}`).toBeTruthy();
            return Number(match?.[1] ?? 0);
          });
          const total = minutes.reduce((sum, value) => sum + value, 0);
          expect(total).toBeGreaterThanOrEqual(35);
          expect(total).toBeLessThanOrEqual(60);
        });

        test("proof checklist matches the pasted-evidence session shape", () => {
          expect(guide.proofChecklist.length).toBeGreaterThanOrEqual(3);
          expect(guide.proofChecklist.join(" ")).toMatch(/paste|transcript|output|prompt/i);
        });

        test("step definitions track the step list with start/working/final proof stages", () => {
          expect(guide.stepDefinitions).toHaveLength(guide.steps.length);
          expect(guide.stepDefinitions[0].proofRequirement.key).toBe("starting-context");
          expect(guide.stepDefinitions[guide.stepDefinitions.length - 1].proofRequirement.key).toBe("visible-proof");
          for (const definition of guide.stepDefinitions.slice(1, -1)) {
            expect(definition.proofRequirement.key).toBe("working-draft");
          }
        });
      });
    }

    test(`${pathId} unknown module titles fall back to an AI-tool-style path template`, () => {
      const guide = guideFor(pathId, "Custom Module That Does Not Exist");
      expect(guide.steps.length).toBeGreaterThanOrEqual(4);
      expect(guide.steps.filter((step) => EMBEDDED_PROMPT.test(step)).length).toBeGreaterThanOrEqual(2);
      expect(guide.steps[guide.steps.length - 1]).toMatch(/artifact/i);
    });
  }

  test("other career paths keep their original playbooks", () => {
    const guide = guideFor("branding-design", "Image Synthesis");
    expect(guide.steps).toEqual([
      "Start from one brand or campaign need that already exists.",
      "Generate a first round of outputs using the module workflow.",
      "Select the strongest variants and document the creative reasoning behind them.",
    ]);
  });

  test("multi-step guides still mark the last step as the visible-proof step for 3-step paths", () => {
    const guide = guideFor("software-engineering", "API Integration");
    expect(guide.stepDefinitions[0].proofRequirement.key).toBe("starting-context");
    expect(guide.stepDefinitions[1].proofRequirement.key).toBe("working-draft");
    expect(guide.stepDefinitions[2].proofRequirement.key).toBe("visible-proof");
  });
});

describe("persona label scrub (F7)", () => {
  test("resolveLearnerRoleLabel prefers a real headline", async () => {
    const { resolveLearnerRoleLabel } = await import("@aitutor/shared");
    expect(resolveLearnerRoleLabel({ headline: "Senior Product Manager", careerPathId: "product-management" })).toBe(
      "Senior Product Manager",
    );
  });

  test("resolveLearnerRoleLabel maps the legacy 'AI Builder' persona to the career path name", async () => {
    const { resolveLearnerRoleLabel } = await import("@aitutor/shared");
    expect(resolveLearnerRoleLabel({ headline: "AI Builder", careerPathId: "product-management" })).toBe(
      "Product Management",
    );
    expect(resolveLearnerRoleLabel({ headline: "  ai builder ", careerPathId: "marketing-seo" })).toBe(
      "Marketing & SEO",
    );
  });

  test("resolveLearnerRoleLabel falls back to a neutral label without a career path", () => {
    return import("@aitutor/shared").then(({ resolveLearnerRoleLabel }) => {
      expect(resolveLearnerRoleLabel({ headline: "AI Builder", careerPathId: null })).toBe("Learner");
      expect(resolveLearnerRoleLabel({ headline: null, careerPathId: undefined })).toBe("Learner");
    });
  });

  test("module guides never render 'For AI Builder' when the legacy persona headline leaks in as jobTitle", () => {
    const guide = buildRecommendedModuleGuide({
      careerPathId: "product-management",
      moduleTitle: "PRD Generation",
      jobTitle: "AI Builder",
      primaryGoal: "upskill_current_job",
    });
    expect(guide.whyThisModule).not.toContain("AI Builder");
    expect(guide.whyThisModule).toContain("Product Management");
  });

  test("fallback guides also scrub the legacy persona", () => {
    const guide = buildRecommendedModuleGuide({
      careerPathId: "operations",
      moduleTitle: "Workflow Automation",
      jobTitle: "AI Builder",
      primaryGoal: null,
    });
    expect(guide.whyThisModule).not.toContain("AI Builder");
  });
});
