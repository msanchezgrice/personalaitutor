import { expect, test } from "@playwright/test";

test.describe("hard gate browser verification", () => {
  test("landing keeps legacy copy removed and light mode enforced", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /take the ai assessment/i })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("#theme-toggle")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/cryptographically verified/i);
    await expect(page.locator("body")).not.toContainText(/cryptographic/i);
  });

  test("onboarding route loads react wizard and onboarding options come from matrix API", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/onboarding\/?$/);
    await expect(page.locator("#onboarding-react-root")).toBeVisible();
    await expect(page.getByText("Career Category")).toBeVisible();
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();

    const startResponse = await page.request.post("/api/onboarding/start", {
      data: {
        name: "Playwright Matrix",
        handleBase: `pw-matrix-${Date.now()}`,
        careerPathId: "product-management",
      },
    });
    expect(startResponse.status()).toBe(200);
    const startBody = await startResponse.json();
    expect(startBody.ok).toBe(true);
    expect(Array.isArray(startBody.onboardingOptions)).toBe(true);
    expect(startBody.onboardingOptions.length).toBeGreaterThan(3);
    expect(startBody.onboardingOptions.some((option: { id: string }) => option.id === "software-engineering")).toBe(true);
  });

  test("dashboard routes enforce auth and expose explicit fail-state redirect", async ({ page }) => {
    const sessionResponse = await page.request.get("/api/auth/session");
    expect(sessionResponse.status()).toBe(401);
    const body = await sessionResponse.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("UNAUTHENTICATED");

    const dashboardChatResponse = await page.request.get("/dashboard/chat", { maxRedirects: 0 });
    expect([307, 308]).toContain(dashboardChatResponse.status());
    expect(dashboardChatResponse.headers().location || "").toContain("/sign-in?");
  });

  test("employer talent page hydrates matrix-driven filters and cards", async ({ page }) => {
    const dataResponse = await page.request.get("/api/employers/talent");
    expect(dataResponse.status()).toBe(200);
    const apiBody = await dataResponse.json();
    expect(apiBody.ok).toBe(true);
    const matrixFilterValues = Array.isArray(apiBody.facets?.skills)
      ? apiBody.facets.skills
      : Array.isArray(apiBody.facets?.modules)
        ? apiBody.facets.modules
        : [];
    expect(Array.isArray(matrixFilterValues)).toBe(true);
    expect(matrixFilterValues.length).toBeGreaterThan(1);

    await page.goto("/employers/talent");

    const skillFilters = page.locator("aside input[type='checkbox']");
    await expect.poll(() => skillFilters.count(), { timeout: 15_000 }).toBeGreaterThan(1);

    const uiSkillLabels = (await page.locator("aside .space-y-2 label span").allTextContents())
      .map((entry) => entry.trim())
      .filter(Boolean);
    expect(uiSkillLabels.length).toBeGreaterThan(0);
    expect(uiSkillLabels.length).toBeGreaterThanOrEqual(Math.min(2, matrixFilterValues.length));

    const cards = page.locator(".grid.md\\:grid-cols-2.lg\\:grid-cols-3.gap-6 a[href^='/employers/talent/']");
    await expect.poll(() => cards.count(), { timeout: 15_000 }).toBeGreaterThan(0);

    const firstFilter = skillFilters.first();
    await firstFilter.check();
    await expect(cards.first()).toBeVisible();
  });
});
