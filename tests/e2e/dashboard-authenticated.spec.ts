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

  test("home FTUE explains the layout and recommended work opens the workbench", async ({ page }) => {
    await page.goto("/dashboard/?welcome=1");

    await expect(page.locator("[data-dashboard-home-content='1']")).toBeVisible();
    await expect(page.getByText("How this works")).toBeVisible();
    await page.getByRole("link", { name: /start recommended work/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/projects\/?#pack-workbench$/);
    await expect(page.locator("#pack-workbench")).toBeVisible();
    await expect(page.getByText("Why this module")).toBeVisible();
  });

  test("projects page shows the module workbench instead of dropping the user into chat", async ({ page }) => {
    await page.goto("/dashboard/projects/");

    await expect(page.getByRole("heading", { name: /project portfolio/i })).toBeVisible();
    await expect(page.locator("#pack-workbench")).toBeVisible();
    await expect(page.getByText("Build steps")).toBeVisible();
    await expect(page.getByText("Tool launchers")).toBeVisible();
  });

  test("activity page renders user-visible actions", async ({ page }) => {
    await page.goto("/dashboard/updates/");

    await expect(page.getByRole("heading", { name: /recent user activity/i })).toBeVisible();
    const activityCards = page.locator("article.glass");
    await expect.poll(() => activityCards.count()).toBeGreaterThan(0);
    await expect(page.locator("body")).not.toContainText(/No user actions yet/i);
  });
});
