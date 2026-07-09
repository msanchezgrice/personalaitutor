import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server.node.js";

/**
 * D. Logged-in assessment retake must not flow through the anonymous
 * lead-gen funnel: header copy adapts, the finale skips email capture,
 * and the submit route links the report to the account directly.
 * The anonymous flow stays byte-identical in behavior.
 */

const { mockGetAuthSeed } = vi.hoisted(() => ({
  mockGetAuthSeed: vi.fn(),
}));

class MockNextRequest extends Request {
  nextUrl: URL;

  constructor(input: string, init?: RequestInit) {
    super(input, init);
    this.nextUrl = new URL(input);
  }
}

vi.mock("next/server", () => ({
  NextRequest: MockNextRequest,
}), { virtual: true });

vi.mock("@/lib/auth", () => ({
  getAuthSeed: mockGetAuthSeed,
}));

vi.mock("@/lib/analytics", () => ({
  captureAnalyticsEvent: vi.fn(),
  getOrCreateFunnelVisitorId: vi.fn(() => "visitor_test"),
}));

vi.mock("@/lib/assessment-report", () => ({
  computeDeterministicAssessmentScore: vi.fn(() => 55),
  generateAssessmentReport: vi.fn(async () => ({
    model: "test-model",
    report: {
      readinessScore: 61,
      headline: "Test headline",
      strengths: [],
      gaps: [],
      plan: [],
    },
  })),
}));

import { AnonymousAssessment } from "../../apps/web/components/anonymous-assessment";
import {
  createAnonymousAssessment,
  findAnonymousAssessmentByToken,
  listAssessmentReports,
  resetAnonymousAssessmentStateForTests,
} from "../../apps/web/lib/anonymous-assessment";
import { POST as submitPost } from "../../apps/web/app/api/assessment/anonymous/submit/route";

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

const SUBMIT_BODY_BASE = {
  careerPathId: "product-management",
  careerCategoryLabel: "Product Manager",
  situation: "employed" as const,
  goals: ["upskill_current_job"],
  aiComfort: 3,
  answers: [
    { questionId: "ai_tool_frequency", value: 4 },
    { questionId: "prompt_skill", value: 3 },
    { questionId: "workflow_automation", value: 2 },
    { questionId: "ai_judgment", value: 4 },
    { questionId: "ai_artifacts", value: 3 },
  ],
};

async function postSubmit(sessionToken: string) {
  return submitPost(
    new MockNextRequest("http://localhost/api/assessment/anonymous/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...SUBMIT_BODY_BASE, sessionToken }),
    }) as never,
  );
}

describe("authed assessment retake", () => {
  beforeEach(() => {
    resetAnonymousAssessmentStateForTests();
    mockGetAuthSeed.mockReset();
    mockGetAuthSeed.mockResolvedValue(null);
  });

  test("/assessment page detects the Clerk session server-side and passes a viewer", () => {
    const source = read("apps/web/app/assessment/page.tsx");
    expect(source).toContain("getAuthSeed");
    expect(source).toContain("viewer");
  });

  test("header copy drops 'No account required' for signed-in users", () => {
    const anonymousHtml = renderToStaticMarkup(createElement(AnonymousAssessment));
    expect(anonymousHtml).toContain("No account required");
    expect(anonymousHtml).not.toContain("Signed in as");

    const authedHtml = renderToStaticMarkup(
      createElement(AnonymousAssessment, {
        viewer: { name: "Miguel", email: "miguel@example.com" },
      }),
    );
    expect(authedHtml).not.toContain("No account required");
    expect(authedHtml).toContain("Signed in as miguel@example.com");
    // No "Already have an account? Sign in" prompt for someone signed in.
    expect(authedHtml).not.toContain("Already have an account?");
  });

  test("finale skips email capture entirely for signed-in users", () => {
    const source = read("apps/web/components/anonymous-assessment.tsx");
    // Authed finale: report link + dashboard link instead of the email form.
    expect(source).toContain("View Full Report");
    expect(source).toContain("Back to Dashboard");
    expect(source).toContain('href="/dashboard/"');
    // The flow stays Clerk-free client-side: auth arrives via server prop.
    expect(source).not.toContain("useAuth");
    expect(source).toContain("viewer");
  });

  test("submit links the retake to the learner profile when authenticated", async () => {
    mockGetAuthSeed.mockResolvedValue({
      userId: "user_authed_retake",
      name: "Authed User",
      email: "retake@example.com",
      handleBase: "authed-user",
      avatarUrl: null,
    });

    const created = await createAnonymousAssessment({
      careerPathId: "product-management",
      visitorId: "visitor_test",
    });

    const response = await postSubmit(created.sessionToken);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.score).toBe(61);

    const assessment = await findAnonymousAssessmentByToken(created.sessionToken);
    expect(assessment?.email).toBe("retake@example.com");
    expect(assessment?.learnerProfileId).toBeTruthy();
    expect(assessment?.status).toBe("completed");

    const reports = await listAssessmentReports(created.id);
    expect(reports).toHaveLength(1);
    expect(reports[0].learnerProfileId).toBe(assessment?.learnerProfileId);
  });

  test("anonymous submit behavior is unchanged (no email, no profile link)", async () => {
    mockGetAuthSeed.mockResolvedValue(null);

    const created = await createAnonymousAssessment({
      careerPathId: "product-management",
      visitorId: "visitor_test",
    });

    const response = await postSubmit(created.sessionToken);
    expect(response.status).toBe(200);

    const assessment = await findAnonymousAssessmentByToken(created.sessionToken);
    expect(assessment?.email).toBeNull();
    expect(assessment?.learnerProfileId).toBeNull();
    expect(assessment?.status).toBe("submitted");

    const reports = await listAssessmentReports(created.id);
    expect(reports).toHaveLength(1);
    expect(reports[0].learnerProfileId).toBeNull();
  });

  test("a linking failure never fails the submit (report still returned)", async () => {
    mockGetAuthSeed.mockRejectedValue(new Error("clerk offline"));

    const created = await createAnonymousAssessment({
      careerPathId: "product-management",
      visitorId: "visitor_test",
    });

    const response = await postSubmit(created.sessionToken);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.score).toBe(61);
  });
});
