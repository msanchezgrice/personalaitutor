import { describe, expect, test } from "vitest";
import { buildLifecycleEmail, resolveLifecycleEmailKey } from "../../packages/shared/src/lifecycle-email";

describe("lifecycle email helpers", () => {
  test("welcome is always first when it has not been sent", () => {
    const next = resolveLifecycleEmailKey({
      anchorIso: "2026-03-01T12:00:00.000Z",
      nowIso: "2026-03-10T12:00:00.000Z",
      sentKeys: [],
    });

    expect(next).toBe("welcome");
  });

  test("resolver picks the current stage instead of replaying the full backlog", () => {
    const next = resolveLifecycleEmailKey({
      anchorIso: "2026-03-01T12:00:00.000Z",
      nowIso: "2026-03-09T12:00:00.000Z",
      sentKeys: ["welcome"],
    });

    expect(next).toBe("week_1_digest");
  });

  test("day one completed email includes quiz feedback and a module CTA", () => {
    const email = buildLifecycleEmail({
      key: "day_1_next_steps",
      baseUrl: "https://www.myaiskilltutor.com",
      learnerName: "Miguel",
      learnerHandle: "miguel",
      careerPathName: "Software Engineering",
      goals: ["ship_ai_projects"],
      dashboardUrl: "https://www.myaiskilltutor.com/dashboard/",
      publicProfileUrl: "https://www.myaiskilltutor.com/u/miguel",
      assessment: {
        score: 0.74,
        answers: [
          { questionId: "ai_comfort", value: 4 },
          { questionId: "career_experience", value: 5 },
        ],
        recommendedCareerPathIds: ["software-engineering", "product-management"],
        startedAt: "2026-03-02T12:00:00.000Z",
        submittedAt: "2026-03-02T12:05:00.000Z",
      },
      moduleCta: {
        title: "API Integration",
        href: "https://www.myaiskilltutor.com/dashboard/?module=API%20Integration",
        buttonLabel: "Continue API Integration",
        helperText: "Keep building from the module you already started.",
      },
    });

    expect(email.subject).toContain("quiz results");
    expect(email.html).toContain("AI comfort");
    expect(email.html).toContain("Recommended paths");
    expect(email.text).toContain("Continue API Integration");
  });

  test("week one digest includes social drafts and AI news", () => {
    const email = buildLifecycleEmail({
      key: "week_1_digest",
      baseUrl: "https://www.myaiskilltutor.com",
      learnerName: "Miguel",
      learnerHandle: "miguel",
      careerPathName: "Software Engineering",
      dashboardUrl: "https://www.myaiskilltutor.com/dashboard/",
      publicProfileUrl: "https://www.myaiskilltutor.com/u/miguel",
      moduleCta: {
        title: "System Architecture",
        href: "https://www.myaiskilltutor.com/dashboard/?module=System%20Architecture",
        buttonLabel: "Continue System Architecture",
        helperText: "Keep building from the module you already started.",
      },
      project: {
        title: "Support Copilot",
        url: "https://www.myaiskilltutor.com/u/miguel/projects/support-copilot",
        state: "building",
      },
      socialDrafts: [
        { platform: "linkedin", text: "I turned this week into visible proof." },
        { platform: "x", text: "Shipping proof, not just notes." },
      ],
      newsItems: [
        {
          title: "Model eval gates are getting stricter",
          summary: "Teams are hardening release checks.",
          url: "https://example.com/evals",
          source: "OpenAI News",
          whyRelevant: "This matters if you are shipping user-facing AI workflows.",
          recommendedAction: "Add one verification check to your next build.",
        },
      ],
    });

    expect(email.subject).toContain("Week 1 digest");
    expect(email.html).toContain("Draft social posts");
    expect(email.html).toContain("Model eval gates are getting stricter");
    expect(email.text).toContain("LinkedIn draft");
  });
});
