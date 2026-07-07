import { describe, expect, test, vi } from "vitest";
// eslint-disable-next-line import/no-relative-packages -- matches existing test convention
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";
import { createElement } from "react";

const assessmentFixture = {
  id: "assessment-1",
  sessionToken: "tok_test_1234567890abcdef1234567890",
  status: "completed",
  careerPathId: "marketing-seo",
  careerCategoryLabel: "Marketing",
  jobTitle: "Growth Marketing Manager",
  yearsExperience: "5-10",
  companySize: "small",
  situation: "employed",
  goals: ["upskill_current_job"],
  aiComfort: 3,
  linkedinUrl: null,
  resumeText: null,
  answers: [],
  email: "person@example.com",
  emailCapturedAt: "2026-07-07T00:00:00.000Z",
  reportEmailSentAt: null,
  learnerProfileId: null,
  linkedAt: null,
  visitorId: null,
  createdAt: "2026-07-07T00:00:00.000Z",
  updatedAt: "2026-07-07T00:00:00.000Z",
  submittedAt: "2026-07-07T00:00:00.000Z",
};

const reportFixture = {
  id: "report-1",
  anonymousAssessmentId: "assessment-1",
  learnerProfileId: null,
  readinessScore: 62,
  deterministicScore: 0.56,
  model: "gpt-4.1-mini",
  createdAt: "2026-07-07T00:00:00.000Z",
  report: {
    readinessScore: 62,
    headline: "Strong instincts, weak systems.",
    summary: "You already use AI daily but nothing is systematized.",
    strengths: [{ title: "Prompt fluency", detail: "Usable output in one or two tries." }],
    gaps: [
      { title: "No automated campaign pipeline", whyItMatters: "Growth roles now expect it.", marketImpact: "high" },
      { title: "Manual reporting", whyItMatters: "Hours lost weekly.", marketImpact: "medium" },
    ],
    recommendedPath: { careerPathId: "marketing-seo", reason: "Direct match for your role." },
    thirtyDayPlan: [
      { week: 1, focus: "Automate one report", actions: ["Pick the weekly deck", "Build the prompt pack"] },
      { week: 2, focus: "Content pipeline", actions: ["Cluster keywords with AI"] },
    ],
  },
};

vi.mock("@/lib/anonymous-assessment", () => ({
  findAnonymousAssessmentByToken: vi.fn(async (token: string) =>
    token === assessmentFixture.sessionToken ? assessmentFixture : null,
  ),
  getLatestAssessmentReport: vi.fn(async () => reportFixture),
  listAssessmentReports: vi.fn(async () => [
    { ...reportFixture, id: "report-0", readinessScore: 48 },
    reportFixture,
  ]),
}));


describe("assessment report page", () => {
  test("renders the score, gaps, plan, and score history for a valid token", async () => {
    const { default: AssessmentReportPage } = await import(
      "../../apps/web/app/assessment/report/[token]/page"
    );

    const element = await AssessmentReportPage({
      params: Promise.resolve({ token: assessmentFixture.sessionToken }),
    });
    const html = renderToStaticMarkup(createElement(() => element));

    expect(html).toContain("62");
    expect(html).toContain("Strong instincts, weak systems.");
    expect(html).toContain("No automated campaign pipeline");
    expect(html).toContain("High impact");
    expect(html).toContain("Your 30-Day Plan");
    expect(html).toContain("Week 1");
    expect(html).toContain("Marketing &amp; SEO");
    // Score history trend (48 → 62).
    expect(html).toContain("Score history");
    expect(html).toContain("48");
    // CTA to create an account.
    expect(html).toContain("/sign-up?redirect_url=/dashboard/");
  });

  test("404s for an unknown token", async () => {
    const { default: AssessmentReportPage } = await import(
      "../../apps/web/app/assessment/report/[token]/page"
    );

    // Next's real notFound() throws its 404 control-flow error.
    await expect(
      AssessmentReportPage({ params: Promise.resolve({ token: "unknown-token-1234567890" }) }),
    ).rejects.toThrow(/404|NOT_FOUND/);
  });
});
