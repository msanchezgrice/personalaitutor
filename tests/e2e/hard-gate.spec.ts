import { expect, test } from "@playwright/test";

test.describe("hard gate browser verification", () => {
  test("landing assessment CTA works", async ({ page }) => {
    await page.goto("/");

    const assessmentCta = page.getByRole("link", { name: /take the ai assessment/i });
    await expect(assessmentCta).toBeVisible();

    await assessmentCta.click();
    await expect(page).toHaveURL(/\/assessment\/?$/);

    await expect(page.getByRole("link", { name: /continue/i })).toBeVisible();
  });

  test("onboarding route loads wizard controls", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/onboarding\/?$/);
    await expect(page.locator("#onboarding-situation")).toBeVisible();
    await expect(page.locator("#onboarding-career-path")).toBeVisible();
    await expect(page.locator("#onboarding-start-assessment")).toBeVisible();
  });

  test("dashboard routes and session API require auth", async ({ page }) => {
    const sessionResponse = await page.request.get("/api/auth/session");
    expect(sessionResponse.status()).toBe(401);
    const body = await sessionResponse.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("UNAUTHENTICATED");

    const dashboardChatResponse = await page.request.get("/dashboard/chat", { maxRedirects: 0 });
    expect([307, 308]).toContain(dashboardChatResponse.status());
    expect(dashboardChatResponse.headers().location || "").toContain("/sign-in?");
  });

  test("employer talent page hydrates with matrix-driven filters", async ({ page }) => {
    await page.goto("/employers/talent");

    const skillFilters = page.locator("aside input[type='checkbox']");
    await expect.poll(() => skillFilters.count(), { timeout: 15_000 }).toBeGreaterThan(1);

    const cards = page.locator(".grid.md\\:grid-cols-2.lg\\:grid-cols-3.gap-6 a[href^='/employers/talent/']");
    await expect.poll(() => cards.count(), { timeout: 15_000 }).toBeGreaterThan(0);

    const firstFilter = skillFilters.first();
    await firstFilter.check();

    await expect(cards.first()).toBeVisible();
  });
});
