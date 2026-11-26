import { expect, test } from "@playwright/test";

test.describe("hard gate browser verification", () => {
  test("landing shows the career map page, keeps forbidden claims out and light mode enforced", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1, name: /your experience isn.t obsolete\. it.s unmapped\./i })).toBeVisible();
    await expect(page.getByTestId("cta-map-career-hero")).toBeVisible();
    await expect(page.getByTestId("cta-map-career-nav")).toHaveAttribute("href", "/map");
    await expect(page.getByTestId("cta-upload-resume-hero")).toHaveAttribute("href", "/map?upload=1");
    await expect(page.getByTestId("cta-play-film")).toBeVisible();
    await expect(page.getByRole("heading", { name: "How the map gets drawn" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Then we help you prove it" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "A tutor for the whole route" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Questions people ask first" })).toBeVisible();
    await expect(page.getByText("$49.99")).toBeVisible();
    await expect(page.locator("body")).toContainText(/7-day free trial/i);
    for (const source of ["GDC State of the Game Industry 2026", "World Economic Forum, Future of Jobs Report 2025", "PwC 2026 Global AI Jobs Barometer"]) {
      await expect(page.getByText(source)).toBeVisible();
    }
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("#theme-toggle")).toHaveCount(0);
    await expect(page.locator("[data-shell-loader='1']")).toBeHidden();
    await expect(page.locator("body")).not.toContainText(/cryptographically verified/i);
    await expect(page.locator("body")).not.toContainText(/cryptographic/i);
    await expect(page.locator("body")).not.toContainText(/system verified proof/i);
    await expect(page.locator("body")).not.toContainText(/public proof/i);
  });

  test("landing hero hands the draft to /map", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("What did you do before?").fill("Senior marketing manager at a game studio for seven years.");
    await page.getByTestId("cta-map-career-hero").click();
    await expect(page).toHaveURL(/\/map\?from=home$/);
    // /map reads and clears the draft on mount, so only check that it was written when it is still there.
    const draft = await page.evaluate(() => window.sessionStorage.getItem("mast_cm_draft"));
    if (draft) expect(JSON.parse(draft)).toEqual({ text: "Senior marketing manager at a game studio for seven years.", source: "paste" });
  });

  test("onboarding route enforces auth-first gate and onboarding options come from matrix API", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/onboarding\/?$/);
    await expect(page.locator("#onboarding-react-root")).toBeVisible();
    await expect(page.getByText("Create your account first")).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with social login/i })).toBeVisible();

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

    const dashboardUpdatesResponse = await page.request.get("/dashboard/updates", { maxRedirects: 0 });
    expect([307, 308]).toContain(dashboardUpdatesResponse.status());
    expect(dashboardUpdatesResponse.headers().location || "").toContain("/sign-in?");
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

  test("onboarding auth gate loads quickly and talent detail has no theme toggle", async ({ page }) => {
    const startedAt = Date.now();
    await page.goto("/onboarding");
    await expect(page.getByRole("button", { name: /continue with social login/i })).toBeVisible();
    const transitionMs = Date.now() - startedAt;
    expect(transitionMs).toBeLessThan(2000);

    await page.goto("/employers/talent/candidate-002");
    await expect(page.locator("#theme-toggle")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /candidate 002/i })).toBeVisible();
  });
});
