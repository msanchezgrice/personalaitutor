import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  captureAssessmentEmail,
  createAnonymousAssessment,
  appendAssessmentReport,
  findLatestAnonymousAssessmentByEmail,
  getLatestAssessmentReport,
  listAssessmentReports,
  resetAnonymousAssessmentStateForTests,
  submitAnonymousAssessment,
} from "@/lib/anonymous-assessment";
import {
  findLinkedReadinessReport,
  resolveOnboardingReadiness,
} from "@/lib/onboarding-readiness";

/**
 * UX audit F1: onboarding must never show the deterministic risk score again.
 * If the signed-in user has an (email-matched) anonymous assessment report,
 * the onboarding finale reuses THAT readiness score. If none exists, the
 * Phase 1 LLM readiness report runs against the onboarding inputs.
 */

const sampleReport = {
  readinessScore: 58,
  headline: "Strong instincts, manual toolkit.",
  summary: "s",
  strengths: [{ title: "t", detail: "d" }],
  gaps: [{ title: "g", whyItMatters: "w", marketImpact: "high" as const }],
  recommendedPath: { careerPathId: "product-management", reason: "r" },
  thirtyDayPlan: [{ week: 1, focus: "f", actions: ["a"] }],
};

const generatedLlmReport = {
  readinessScore: 47,
  headline: "You are one workflow away from compounding.",
  summary: "Summary grounded in answers.",
  strengths: [{ title: "Consistency", detail: "Ships weekly." }],
  gaps: [{ title: "No automation", whyItMatters: "Market moves faster.", marketImpact: "high" }],
  recommendedPath: { careerPathId: "product-management", reason: "Matches role." },
  thirtyDayPlan: [
    { week: 1, focus: "Baseline", actions: ["Do one rep"] },
    { week: 2, focus: "Automate", actions: ["Automate one step"] },
    { week: 3, focus: "Prove", actions: ["Publish proof"] },
    { week: 4, focus: "Repeat", actions: ["Run it again"] },
  ],
};

const onboardingInput = {
  email: "migs@example.com",
  learnerProfileId: "profile-0001",
  role: {
    careerPathId: "product-management",
    careerCategoryLabel: "Product Manager",
    jobTitle: "Senior PM",
    yearsExperience: "3-5",
    companySize: "small",
    situation: "employed",
  },
  goals: ["upskill_current_job"],
  aiComfort: 3,
  linkedinUrl: null,
  answers: [
    { questionId: "career_experience", value: 3 },
    { questionId: "ai_comfort", value: 3 },
  ],
  deterministicScore: 0.6,
};

async function seedLinkedAssessment(email: string) {
  const created = await createAnonymousAssessment({ careerPathId: "product-management" });
  await submitAnonymousAssessment({
    sessionToken: created.sessionToken,
    careerPathId: "product-management",
    careerCategoryLabel: "Product Manager",
    jobTitle: "PM",
    situation: "employed",
    goals: ["upskill_current_job"],
    answers: [{ questionId: "career_experience", value: 4 }],
  });
  await captureAssessmentEmail({ sessionToken: created.sessionToken, email });
  await appendAssessmentReport({
    anonymousAssessmentId: created.id,
    readinessScore: sampleReport.readinessScore,
    report: sampleReport,
  });
  return created;
}

describe("onboarding readiness routing (F1)", () => {
  beforeEach(() => {
    resetAnonymousAssessmentStateForTests();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("linked assessment report wins: no LLM call, returns their score + report link", async () => {
    const created = await seedLinkedAssessment("migs@example.com");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await resolveOnboardingReadiness(onboardingInput);
    expect(result.source).toBe("linked");
    expect(result.readinessScore).toBe(58);
    expect(result.headline).toBe(sampleReport.headline);
    expect(result.reportPath).toBe(`/assessment/report/${encodeURIComponent(created.sessionToken)}`);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("an assessment without a report does not count as linked", async () => {
    const created = await createAnonymousAssessment({});
    await captureAssessmentEmail({ sessionToken: created.sessionToken, email: "migs@example.com" });
    expect(await findLinkedReadinessReport("migs@example.com")).toBeNull();
  });

  test("no linked assessment: generates the Phase 1 LLM report from onboarding inputs and persists it", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ output_text: JSON.stringify(generatedLlmReport) }),
        text: async () => "",
      }),
    );

    const result = await resolveOnboardingReadiness(onboardingInput);
    expect(result.source).toBe("generated");
    expect(result.readinessScore).toBe(47);
    expect(result.headline).toBe(generatedLlmReport.headline);

    // The report joined the same score spine used by the dashboard card.
    const assessment = await findLatestAnonymousAssessmentByEmail("migs@example.com");
    expect(assessment).toBeTruthy();
    expect(assessment?.learnerProfileId).toBe("profile-0001");
    const persisted = await getLatestAssessmentReport(assessment!.id);
    expect(persisted?.readinessScore).toBe(47);
    expect(persisted?.learnerProfileId).toBe("profile-0001");
    expect(result.reportPath).toBe(`/assessment/report/${encodeURIComponent(assessment!.sessionToken)}`);
  });

  test("LLM failure fails loudly and never persists a placeholder report", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(resolveOnboardingReadiness(onboardingInput)).rejects.toThrow("OPENAI_CONFIG_MISSING");

    const assessment = await findLatestAnonymousAssessmentByEmail("migs@example.com");
    if (assessment) {
      expect(await listAssessmentReports(assessment.id)).toHaveLength(0);
    }
  });
});
