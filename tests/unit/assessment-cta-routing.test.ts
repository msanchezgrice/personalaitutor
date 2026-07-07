import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("anonymous assessment routing", () => {
  test("landing CTAs no longer gate the assessment behind sign-up", () => {
    const source = read("apps/web/app/page.tsx");

    expect(source).not.toContain("/sign-up?redirect_url=/onboarding/");
    // Signed-in users still get the dashboard shortcut.
    expect(source).toContain('href="/dashboard/?welcome=1"');
  });

  test("landing CTA click tracking follows the assessment links", () => {
    const source = read("apps/web/components/home-page-tracking.tsx");

    expect(source).toContain("a[href$='/assessment/']");
    expect(source).toContain('"landing_cta_clicked"');
  });

  test("the shared Gemini template renderer no longer rewrites assessment links to sign-up", () => {
    const source = read("apps/web/components/gemini-static-page.tsx");

    expect(source).not.toContain("'href=\"/assessment/\"': 'href=\"/sign-up");
    expect(source).not.toContain("'href=\"/assessment\"': 'href=\"/sign-up");
    expect(source).not.toContain("/sign-up?redirect_url=/onboarding/");
  });

  test("landing template CTAs point at the assessment", () => {
    const template = read("mockups/high_fidelity/index.html");
    expect(template).toContain('href="/assessment');
  });

  test("/assessment hosts the anonymous flow instead of redirecting to onboarding", () => {
    const source = read("apps/web/app/assessment/page.tsx");

    expect(source).not.toContain('redirect("/onboarding")');
    expect(source).toContain("AnonymousAssessment");
  });

  test("anonymous flow captures the new funnel events without an onboarding session id", () => {
    const source = read("apps/web/components/anonymous-assessment.tsx");

    expect(source).toContain('"anonymous_assessment_started"');
    expect(source).toContain('"anonymous_assessment_completed"');
    expect(source).toContain('"assessment_email_captured"');
    expect(source).toContain("anonymous_assessment_id");
    // The persisted funnel pipeline maps `session_id` to onboarding sessions;
    // anonymous assessments must never masquerade as one.
    expect(source).not.toContain("session_id:");
    // Email is captured at the end, to deliver the report.
    expect(source).toContain("email");
  });

  test("anonymous flow never gates on Clerk before the quiz", () => {
    const source = read("apps/web/components/anonymous-assessment.tsx");

    expect(source).not.toContain("SignUpButton");
    expect(source).not.toContain("useAuth");
    expect(source).not.toContain("Create your account first");
  });

  test("report page renders the score and tracks the view", () => {
    const page = read("apps/web/app/assessment/report/[token]/page.tsx");
    expect(page).toContain("readinessScore");
    expect(page).toContain("AssessmentReportTracking");

    const tracking = read("apps/web/components/assessment-report-tracking.tsx");
    expect(tracking).toContain('"assessment_report_viewed"');
    expect(tracking).toContain("anonymous_assessment_id");
  });

  test("anonymous assessment API routes exist and fail loudly on report generation", () => {
    const start = read("apps/web/app/api/assessment/anonymous/start/route.ts");
    expect(start).toContain("createAnonymousAssessment");

    const submit = read("apps/web/app/api/assessment/anonymous/submit/route.ts");
    expect(submit).toContain("generateAssessmentReport");
    expect(submit).toContain("appendAssessmentReport");
    expect(submit).toContain("ASSESSMENT_REPORT_FAILED");
    // Hard failure contract: no rule-based fallback text on LLM failure.
    expect(submit).not.toContain("assessmentTemplates");

    const email = read("apps/web/app/api/assessment/anonymous/email/route.ts");
    expect(email).toContain("captureAssessmentEmail");
    expect(email).toContain("sendAssessmentReportEmail");
  });

  test("anonymous assessments are linked to profiles where claiming already happens", () => {
    const dashboardLib = read("apps/web/app/dashboard/_lib.ts");
    expect(dashboardLib).toContain("linkAnonymousAssessmentsToProfile");

    const claimRoute = read("apps/web/app/api/onboarding/claim/route.ts");
    expect(claimRoute).toContain("linkAnonymousAssessmentsToProfile");

    const completeRoute = read("apps/web/app/api/onboarding/complete/route.ts");
    expect(completeRoute).toContain("linkAnonymousAssessmentsToProfile");
  });
});
