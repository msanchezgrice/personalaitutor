import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  ASSESSMENT_QUIZ_QUESTIONS,
  assessmentReportSchema,
  buildAssessmentReportPrompt,
  computeDeterministicAssessmentScore,
  generateAssessmentReport,
  normalizePlanModuleTitle,
  parseAssessmentReport,
  type AssessmentReportInput,
} from "@/lib/assessment-report";
import { CAREER_PATHS } from "@aitutor/shared";

const validReportPayload = {
  readinessScore: 58,
  headline: "Solid foundations, but your role is moving faster than your toolkit.",
  summary:
    "You use AI tools occasionally but have not yet systematized them into your product workflow. The market for AI-native product managers is accelerating.",
  strengths: [
    { title: "Prompt fundamentals", detail: "You can already get usable output from AI tools." },
    { title: "Role experience", detail: "5+ years of product context to aim AI at." },
  ],
  gaps: [
    {
      title: "No automated workflow",
      whyItMatters: "PM roles increasingly expect AI-assisted PRD and research pipelines.",
      marketImpact: "high",
    },
    {
      title: "Limited output verification habits",
      whyItMatters: "Shipping unchecked AI output erodes stakeholder trust.",
      marketImpact: "medium",
    },
  ],
  recommendedPath: {
    careerPathId: "product-management",
    reason: "Your role and goals map directly to the AI-native PM track.",
  },
  thirtyDayPlan: [
    { week: 1, focus: "Automate one recurring PRD workflow", actions: ["Pick one weekly doc", "Build a prompt pack"] },
    { week: 2, focus: "Synthetic user research", actions: ["Run one AI-led interview synthesis"] },
    { week: 3, focus: "Verification habits", actions: ["Create an output review checklist"] },
    { week: 4, focus: "Publish proof", actions: ["Ship one before/after case study"] },
  ],
};

function baseInput(): AssessmentReportInput {
  return {
    role: {
      careerPathId: "product-management",
      careerCategoryLabel: "Product Manager",
      jobTitle: "Senior PM",
      yearsExperience: "5-10",
      companySize: "medium",
      situation: "employed",
    },
    goals: ["upskill_current_job", "ship_ai_projects"],
    aiComfort: 3,
    answers: [
      { questionId: "ai_tool_frequency", value: 3 },
      { questionId: "prompt_skill", value: 4 },
      { questionId: "workflow_automation", value: 2 },
      { questionId: "ai_judgment", value: 3 },
      { questionId: "ai_artifacts", value: 2 },
    ],
    linkedinUrl: "https://linkedin.com/in/example",
    resumeText: "Led roadmap for a B2B analytics platform. Shipped 4 major releases.",
    deterministicScore: 0.56,
  };
}

function okOpenAiResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ output_text: typeof payload === "string" ? payload : JSON.stringify(payload) }),
    text: async () => "",
  };
}

describe("assessment quiz + deterministic score", () => {
  test("exposes five quiz questions with stable ids", () => {
    expect(ASSESSMENT_QUIZ_QUESTIONS).toHaveLength(5);
    const ids = ASSESSMENT_QUIZ_QUESTIONS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(5);
    for (const question of ASSESSMENT_QUIZ_QUESTIONS) {
      expect(question.question.length).toBeGreaterThan(10);
      expect(question.lowLabel.length).toBeGreaterThan(0);
      expect(question.highLabel.length).toBeGreaterThan(0);
    }
  });

  test("computes the same deterministic signal formula as the legacy scorer", () => {
    const score = computeDeterministicAssessmentScore([
      { questionId: "a", value: 5 },
      { questionId: "b", value: 3 },
    ]);
    // (5 + 3) / 2 / 5 = 0.8
    expect(score).toBe(0.8);
    expect(computeDeterministicAssessmentScore([])).toBe(0);
  });
});

describe("assessment report schema", () => {
  test("accepts a structurally valid report and keeps gap ranking order", () => {
    const parsed = assessmentReportSchema.parse(validReportPayload);
    expect(parsed.readinessScore).toBe(58);
    expect(parsed.gaps[0].marketImpact).toBe("high");
    expect(parsed.recommendedPath.careerPathId).toBe("product-management");
    expect(parsed.thirtyDayPlan).toHaveLength(4);
  });

  test("rounds fractional readiness scores to integers", () => {
    const parsed = assessmentReportSchema.parse({ ...validReportPayload, readinessScore: 58.6 });
    expect(parsed.readinessScore).toBe(59);
  });

  test("rejects a recommended path outside the nine career paths", () => {
    const result = assessmentReportSchema.safeParse({
      ...validReportPayload,
      recommendedPath: { careerPathId: "prompt-engineering", reason: "nope" },
    });
    expect(result.success).toBe(false);
  });

  test("rejects reports missing gaps", () => {
    const result = assessmentReportSchema.safeParse({ ...validReportPayload, gaps: [] });
    expect(result.success).toBe(false);
  });

  test("accepts an optional moduleTitle per plan week (spine phase 1)", () => {
    const withModules = {
      ...validReportPayload,
      thirtyDayPlan: validReportPayload.thirtyDayPlan.map((week, index) => ({
        ...week,
        ...(index === 0 ? { moduleTitle: "PRD Generation" } : {}),
      })),
    };
    const parsed = assessmentReportSchema.parse(withModules);
    expect(parsed.thirtyDayPlan[0].moduleTitle).toBe("PRD Generation");
    expect(parsed.thirtyDayPlan[1].moduleTitle).toBeUndefined();
  });
});

describe("plan module title normalization (spine phase 1)", () => {
  const PM_MODULES = ["Synthetic User Research", "AI Wireframing", "PRD Generation", "Sentiment Analysis"];

  test("exact and case/punctuation near-miss titles normalize to catalog strings", () => {
    expect(normalizePlanModuleTitle("PRD Generation", PM_MODULES)).toBe("PRD Generation");
    expect(normalizePlanModuleTitle("prd generation", PM_MODULES)).toBe("PRD Generation");
    expect(normalizePlanModuleTitle("  Synthetic User Research  ", PM_MODULES)).toBe("Synthetic User Research");
    expect(normalizePlanModuleTitle("AI Wireframing module", PM_MODULES)).toBe("AI Wireframing");
  });

  test("unmatched or ambiguous titles resolve to undefined", () => {
    expect(normalizePlanModuleTitle("Quantum Basket Weaving", PM_MODULES)).toBeUndefined();
    expect(normalizePlanModuleTitle("", PM_MODULES)).toBeUndefined();
    expect(normalizePlanModuleTitle(null, PM_MODULES)).toBeUndefined();
    // Two catalog entries match by containment -> ambiguous -> undefined.
    expect(
      normalizePlanModuleTitle("AI Wireframing Pro Max", ["AI Wireframing", "AI Wireframing Pro"]),
    ).toBeUndefined();
  });

  test("parseAssessmentReport normalizes plan modules against the recommended path's catalog", () => {
    const raw = JSON.stringify({
      ...validReportPayload,
      thirtyDayPlan: [
        { week: 1, focus: "PRD automation", actions: ["Do it"], moduleTitle: "prd generation" },
        { week: 2, focus: "Research", actions: ["Do it"], moduleTitle: "Synthetic User Research module" },
        { week: 3, focus: "Verification", actions: ["Do it"], moduleTitle: "Quantum Basket Weaving" },
        { week: 4, focus: "Proof", actions: ["Do it"], moduleTitle: "AI Wireframing" },
      ],
    });
    const report = parseAssessmentReport(raw);
    expect(report.thirtyDayPlan.map((week) => week.moduleTitle)).toEqual([
      "PRD Generation",
      "Synthetic User Research",
      undefined,
      "AI Wireframing",
    ]);
  });
});

describe("generateAssessmentReport", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("throws OPENAI_CONFIG_MISSING without an API key and never calls OpenAI", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateAssessmentReport(baseInput())).rejects.toThrow("OPENAI_CONFIG_MISSING");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("returns a validated report from a successful OpenAI response", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(okOpenAiResponse(validReportPayload));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateAssessmentReport(baseInput());

    expect(result.report.readinessScore).toBe(58);
    expect(result.report.recommendedPath.careerPathId).toBe("product-management");
    expect(result.model).toBe("gpt-4.1-mini");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("gpt-4.1-mini");
    expect(body.text?.format?.type).toBe("json_object");
    expect(body.input).toContain("Senior PM");
    expect(body.input).toContain("upskill_current_job");
    expect(body.input).toContain("Led roadmap for a B2B analytics platform");
    // Deterministic signal is passed through as context.
    expect(body.input).toContain("56");
    // All nine career paths are offered as the only valid recommendations.
    for (const path of CAREER_PATHS) {
      expect(body.input).toContain(path.id);
    }
  });

  test("tolerates code-fenced JSON output", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fenced = "```json\n" + JSON.stringify(validReportPayload) + "\n```";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okOpenAiResponse(fenced)));

    const result = await generateAssessmentReport(baseInput());
    expect(result.report.readinessScore).toBe(58);
  });

  test("hard-fails on structurally invalid output with no fallback text", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(okOpenAiResponse({ readinessScore: 55, gaps: "not-a-list" })),
    );

    await expect(generateAssessmentReport(baseInput())).rejects.toThrow("ASSESSMENT_REPORT_INVALID_OUTPUT");
  });

  test("hard-fails on non-JSON output", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okOpenAiResponse("Here is your report: you are doing great!")));

    await expect(generateAssessmentReport(baseInput())).rejects.toThrow("ASSESSMENT_REPORT_INVALID_OUTPUT");
  });

  test("propagates OpenAI HTTP failures loudly", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "upstream exploded",
        json: async () => ({}),
      }),
    );

    await expect(generateAssessmentReport(baseInput())).rejects.toThrow("OPENAI_RESPONSE_FAILED:500");
  });

  test("prompt builder includes role, goals, quiz answers, and signal", () => {
    const prompt = buildAssessmentReportPrompt(baseInput());
    expect(prompt).toContain("Product Manager");
    expect(prompt).toContain("ai_tool_frequency");
    expect(prompt).toContain("ship_ai_projects");
    expect(prompt).toContain("0-100");
  });

  test("prompt instructs the model to name a catalog module per plan week", () => {
    const prompt = buildAssessmentReportPrompt(baseInput());
    expect(prompt).toContain("moduleTitle");
    expect(prompt.toLowerCase()).toContain("copied exactly");
  });
});
