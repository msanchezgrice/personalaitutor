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

  test("onboarding can move user into dashboard", async ({ page }) => {
    await page.goto("/onboarding");

    const directLink = page.getByRole("link", { name: /go directly to dashboard/i });
    await expect(directLink).toBeVisible();

    await directLink.click();
    await expect(page).toHaveURL(/\/dashboard\/?$/);

    await expect(page.locator("aside")).toBeVisible();
    await expect(page.getByText(/chat tutor/i).first()).toBeVisible();
    await expect(page.getByText(/projects/i).first()).toBeVisible();
  });

  test("dashboard chat is wired to backend", async ({ page }) => {
    const summaryResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/dashboard/summary") && response.status() === 200,
      { timeout: 30_000 },
    );

    await page.goto("/dashboard/chat/");
    await summaryResponsePromise;
    await page.waitForTimeout(400);

    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();

    const message = `E2E chat ${Date.now()}`;
    await textarea.fill(message);
    const sendButton = page.locator("button:has(i.fa-paper-plane)").first();
    await expect(sendButton).toBeVisible();

    const chatResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/projects/") &&
        response.url().includes("/chat"),
      { timeout: 30_000 },
    );

    await sendButton.click();
    const chatResponse = await chatResponsePromise;
    expect(chatResponse.status()).toBe(200);
    const body = await chatResponse.text();
    expect(body.includes("\"ok\":true")).toBeTruthy();

    const thread = page.locator("main .flex-1.overflow-y-auto");
    await expect(thread).toContainText(message);
    await expect(thread).toContainText(/AI Tutor:/i);
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
