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
