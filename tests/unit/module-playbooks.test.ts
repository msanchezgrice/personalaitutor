import { describe, expect, test } from "vitest";
import { buildRecommendedModuleGuide, CAREER_PATHS } from "@aitutor/shared";

/**
 * Rich AI-tool playbooks for ALL career paths (rebuild spine phase 5):
 * every module session is a sequence of actions performed inside an AI tool
 * with a copy-pasteable prompt embedded in the step text, produces pasteable
 * evidence, and ends in artifact generation via the tutor. The shipped
 * product-management and marketing-seo playbooks are frozen byte-identical
 * (existing users' tutor sessions key off those step strings).
 */

const AI_TOOL_PATHS = CAREER_PATHS.map((path) => path.id);

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
const BANNED_STEP_CONTENT =
  /\binstall\b|set up your (development )?(environment|machine|local)|environment setup|sign up for|create an account|pip |npm |terminal|command line/i;
const STEP_MINUTES = /\((\d+) min\)/;
const FALLBACK_PROBE_TITLE = "Custom Module That Does Not Exist";

describe("AI-tool playbooks cover every module of every career path", () => {
  for (const pathId of AI_TOOL_PATHS) {
    const modules = pathModules(pathId);

    test(`${pathId} has modules in the catalog`, () => {
      expect(modules.length).toBeGreaterThanOrEqual(3);
    });

    for (const moduleTitle of modules) {
      describe(`${pathId} / ${moduleTitle}`, () => {
        const guide = guideFor(pathId, moduleTitle);

        test("session has exactly 5 steps", () => {
          expect(guide.steps).toHaveLength(5);
        });

        test("module has an exact-key playbook, not the path fallback template", () => {
          const fallback = guideFor(pathId, FALLBACK_PROBE_TITLE);
          const normalizedFallback = fallback.steps
            .join("\n")
            .replaceAll(FALLBACK_PROBE_TITLE, "{module}");
          const normalizedGuide = guide.steps.join("\n").replaceAll(moduleTitle, "{module}");
          expect(normalizedGuide).not.toBe(normalizedFallback);
        });

        test("session is a distinct module playbook from its siblings", () => {
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

        test("session ends in artifact generation via the tutor", () => {
          const finalStep = guide.steps[guide.steps.length - 1];
          expect(finalStep).toMatch(/artifact/i);
          expect(finalStep).toMatch(/tutor/i);
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

        test("why copy never leaks the legacy persona string", () => {
          expect(guide.whyThisModule).not.toContain("AI Builder");
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

    describe(`${pathId} path-level fallback`, () => {
      const guide = guideFor(pathId, FALLBACK_PROBE_TITLE);

      test("unknown module titles fall back to an AI-tool-style path template", () => {
        expect(guide.steps.length).toBeGreaterThanOrEqual(4);
        expect(guide.steps.filter((step) => EMBEDDED_PROMPT.test(step)).length).toBeGreaterThanOrEqual(2);
        expect(guide.steps[guide.steps.length - 1]).toMatch(/artifact/i);
      });

      test("fallback carries minutes hints and no setup boilerplate", () => {
        for (const step of guide.steps) {
          expect(step).toMatch(STEP_MINUTES);
          expect(step).not.toMatch(BANNED_STEP_CONTENT);
        }
      });

      test("fallback proof checklist follows the pasted-evidence shape", () => {
        expect(guide.proofChecklist.length).toBeGreaterThanOrEqual(3);
        expect(guide.proofChecklist.join(" ")).toMatch(/paste|transcript|output|prompt/i);
      });
    });
  }

  test("generic no-template fallback still marks start/working/final proof stages", () => {
    const guide = guideFor("not-a-real-career-path", "Some Module");
    expect(guide.steps).toHaveLength(3);
    expect(guide.stepDefinitions[0].proofRequirement.key).toBe("starting-context");
    expect(guide.stepDefinitions[1].proofRequirement.key).toBe("working-draft");
    expect(guide.stepDefinitions[2].proofRequirement.key).toBe("visible-proof");
  });
});

describe("shipped product-management + marketing-seo playbooks stay byte-identical", () => {
  test("product-management / Synthetic User Research keeps its exact shipped steps", () => {
    const guide = guideFor("product-management", "Synthetic User Research");
    expect(guide.steps).toEqual([
      'Define your ICP in ChatGPT or Claude (8 min). Paste this prompt: "Act as my product research partner. My product is [one line] and my open question is [one line]. Draft my ideal customer profile: role, company size, top 3 jobs-to-be-done, top 3 pains, and the trigger that makes them look for a solution. Ask me up to 3 clarifying questions before you answer." Paste the final ICP into your evidence notes.',
      'Turn the ICP into an interview script (7 min). Prompt: "Using this ICP: [paste ICP], write an 8-question user interview script that probes their current workflow, pains, workarounds, and willingness to change. No leading questions." Save the script — you will reuse it five times.',
      'Run 5 synthetic user interviews (12 min). Open a fresh chat for each persona and paste: "You are a [role from my ICP] at a [company size] company. Stay in character with realistic constraints and skepticism. I will interview you about [topic]. Answer from lived experience, including annoyances and workarounds." Ask your 8 questions, vary one trait per persona (seniority, industry, team size), and copy each full transcript into your evidence.',
      'Extract themes from the transcripts (8 min). Prompt: "Here are 5 user interview transcripts: [paste transcripts]. Extract the top 5 themes ranked by frequency and intensity. For each theme give a name, a 1-sentence summary, one direct quote per interview that supports it, and any contradictions between interviews." Paste the ranked theme table as evidence.',
      "Generate your research brief artifact (10 min). Ask the tutor to generate the brief from your pasted ICP, transcripts, and themes — it must cite the interviews directly. Review it for anything the transcripts do not support, then attach it as your final artifact.",
    ]);
    expect(guide.expectedOutput).toBe(
      "A synthetic user research brief that cites five AI-run interviews: your ICP, ranked themes with supporting quotes, and a recommended next decision.",
    );
  });

  test("marketing-seo / Programmatic SEO keeps its exact shipped opening and closing steps", () => {
    const guide = guideFor("marketing-seo", "Programmatic SEO");
    expect(guide.steps[0]).toBe(
      "Find your repeatable pattern (8 min). Paste this prompt: \"I run [business, one line]. Propose 5 programmatic SEO patterns of the form '[modifier] + [head term]' (like 'X for [industry]' or 'X vs Y') that my audience genuinely searches and that I can answer with data I actually have. For each: the pattern, 10 example long-tail queries, and the dataset that would power it. Ask me what data I have first.\" Paste the chosen pattern and queries into your evidence.",
    );
    expect(guide.steps[4]).toBe(
      "Generate your plan artifact (8 min). Ask the tutor to generate the programmatic SEO plan artifact citing your pattern, dataset, and sample pages, then attach it.",
    );
    expect(guide.proofChecklist).toEqual([
      "Paste the chosen pattern with its example long-tail queries.",
      "Paste the page template with variable slots.",
      "Paste the three generated sample pages and the dataset rows that power them.",
    ]);
  });

  test("marketing-seo path fallback keeps its exact shipped final step", () => {
    const guide = guideFor("marketing-seo", FALLBACK_PROBE_TITLE);
    expect(guide.steps[guide.steps.length - 1]).toBe(
      "Generate your artifact (10 min). Ask the tutor to generate the final artifact from your pasted goal, output, and critique notes, then attach it as proof.",
    );
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
