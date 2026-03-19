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
    await expect(page.locator("[data-billing-gate='1']")).toBeVisible();
    await expect(page.getByText("Your dashboard is ready. Start your 7-day free trial")).toBeVisible();
    await expect(page.getByRole("button", { name: /start 7-day free trial/i })).toBeVisible();
  });

  test("nested dashboard routes redirect back to the gated home route until billing unlocks", async ({ page }) => {
    await page.goto("/dashboard/projects/");

    await expect(page).toHaveURL(/\/dashboard\?billing=required&return_to=%2Fdashboard%2Fprojects/);
    await expect(page.locator("[data-billing-gate='1']")).toBeVisible();
  });
});
