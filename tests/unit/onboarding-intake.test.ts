import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const onboardingIntakePath = path.resolve(process.cwd(), "apps/web/components/onboarding-intake.tsx");

describe("onboarding intake", () => {
  test("does not expose the LinkedIn OAuth flow inside onboarding", () => {
    const source = readFileSync(onboardingIntakePath, "utf8");

    expect(source).not.toContain("Connect LinkedIn");
    expect(source).not.toContain("/api/auth/linkedin/start");
    expect(source).not.toContain("onboarding_linkedin_oauth_started");
    expect(source).not.toContain("linkedin_connected");
  });

  test("stores and restores the completed assessment summary for report return", () => {
    const source = readFileSync(onboardingIntakePath, "utf8");

    expect(source).toContain("ONBOARDING_REPORT_SNAPSHOT_KEY");
    expect(source).toContain("window.sessionStorage.setItem(");
    expect(source).toContain("window.sessionStorage.getItem(ONBOARDING_REPORT_SNAPSHOT_KEY)");
    expect(source).toContain('params.get("view")');
  });

  test("uses the dashboard handoff language after the report", () => {
    const source = readFileSync(onboardingIntakePath, "utf8");

    expect(source).toContain("Go to Dashboard");
    expect(source).not.toContain("Continue to your dashboard preview");
  });
});

describe("onboarding readiness finale (F1)", () => {
  test("the deterministic risk framework is never user-visible", () => {
    const source = readFileSync(onboardingIntakePath, "utf8");

    expect(source).not.toContain("Key Risk Areas");
    expect(source).not.toContain("assessmentTemplates");
    expect(source).not.toContain("Timeline:");
    expect(source).not.toContain("Risk (");
    expect(source).not.toContain("Start AI Analysis");
    expect(source).not.toContain("AI Analysis in Progress");
  });

  test("the finale shows the AI-readiness score with a full-report link", () => {
    const source = readFileSync(onboardingIntakePath, "utf8");

    expect(source).toContain("readiness");
    expect(source).toContain("reportPath");
    expect(source).toContain("View your full report");
    expect(source).toContain("AI-Readiness Score");
  });
});

describe("linked assessment prefill + collapse (F2)", () => {
  test("fetches the linked assessment context for signed-in users", () => {
    const source = readFileSync(onboardingIntakePath, "utf8");
    expect(source).toContain("/api/onboarding/assessment-context");
  });

  test("collapses to a confirm screen when a linked assessment exists", () => {
    const source = readFileSync(onboardingIntakePath, "utf8");
    expect(source).toContain("Confirm Your Details");
    expect(source).toMatch(/collapsed/);
  });
});

describe("copy fixes (F3 + F8)", () => {
  test("review screen never renders 'Not provided' next to the career label", () => {
    const source = readFileSync(onboardingIntakePath, "utf8");
    expect(source).not.toContain('{jobTitle || "Not provided"} (');
  });

  test("the over-promising AI Analysis framing is gone", () => {
    const source = readFileSync(onboardingIntakePath, "utf8");
    expect(source).not.toContain("Ready for AI Analysis");
    expect(source).not.toContain("Analysis typically takes 30-60 seconds");
  });

  test("signed-out variant no longer uses the account-first legacy framing", () => {
    const source = readFileSync(onboardingIntakePath, "utf8");
    expect(source).not.toContain("Create your account first");
    expect(source).not.toContain("then finish your personalized assessment");
  });
});
