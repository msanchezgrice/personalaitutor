import { expect, test } from "@playwright/test";
import { clerkAuthStatePath, hasClerkAuthEnv } from "./clerk-auth";

test.use({ storageState: clerkAuthStatePath });

function shouldSkipLocalAuth(baseURL: string) {
  return (
    (baseURL.includes("localhost") || baseURL.includes("127.0.0.1"))
    && process.env.PLAYWRIGHT_ALLOW_LOCAL_CLERK_AUTH !== "1"
  );
}

test.describe("authenticated dashboard flows", () => {
  test.skip(!hasClerkAuthEnv(), "Authenticated dashboard checks require Clerk auth env.");

  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      shouldSkipLocalAuth(String(testInfo.project.use?.baseURL || "")),
      "Local Clerk auth is opt-in. Set PLAYWRIGHT_ALLOW_LOCAL_CLERK_AUTH=1 after allowing localhost in Clerk.",
    );
  });

  test("home route shows the billing gate overlay for authenticated users without a subscription", async ({ page }) => {
    await page.goto("/dashboard/?welcome=1");

    await expect(page.locator("[data-dashboard-home-content='1']")).toBeVisible();
    await expect(page.locator("[data-dashboard-shell-locked='1']")).toBeVisible();
    await expect(page.locator("[data-billing-gate='1']")).toBeVisible();
    await expect(page.locator("[data-auth-action='sign-out']")).toBeVisible();
    await expect(page.getByText("Your dashboard is ready. Start your 7-day free trial")).toBeVisible();
    await expect(page.getByRole("button", { name: /start 7-day free trial/i })).toBeVisible();
  });

  test("back to my report restores the onboarding summary view", async ({ page }) => {
    await page.addInitScript((snapshot) => {
      window.sessionStorage.setItem("ai_tutor_onboarding_report_snapshot_v1", JSON.stringify(snapshot));
    }, {
      fullName: "Playwright Dashboard",
      careerCategory: "product-manager",
      customCareerCategory: "",
      jobTitle: "Product Manager",
      yearsExperience: "1-3",
      companySize: "51-200",
      situation: "employed",
      linkedinUrl: "https://linkedin.com/in/playwright-dashboard",
      selectedGoals: ["upskill_current_job"],
      aiComfort: 3,
      uploadedResumeName: null,
      ts: Date.now(),
      sessionId: "session_e2e_report",
      sessionUserId: "user_e2e_report",
      sessionToken: "token_e2e_report",
      assessmentScore: 67,
      recommendedPaths: ["product-management"],
      nextRedirectHref: "/dashboard/?welcome=1&onboardingSessionId=session_e2e_report",
      nextRedirectLabel: "Open Dashboard",
    });

    await page.goto("/dashboard/?welcome=1");
    await page.getByRole("button", { name: /back to my report/i }).click();

    await expect(page).toHaveURL(/\/onboarding\?view=report/);
    await expect(page.getByText("Recommended Skills, Modules, and Tools")).toBeVisible();
    await expect(page.getByRole("button", { name: /open dashboard/i })).toBeVisible();
  });

  test("nested dashboard routes redirect back to the gated home route until billing unlocks", async ({ page }) => {
    await page.goto("/dashboard/projects/");

    await expect(page).toHaveURL(/\/dashboard\?billing=required&return_to=%2Fdashboard%2Fprojects/);
    await expect(page.locator("[data-billing-gate='1']")).toBeVisible();
  });
});
