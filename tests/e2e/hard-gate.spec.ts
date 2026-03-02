import { test, expect } from "@playwright/test";

test.describe("hard gate browser verification", () => {
  test("theme toggle persists and hero iframe is non-interactive", async ({ page }) => {
    await page.goto("/");

    const toggle = page.getByRole("button", { name: /toggle theme/i });
    await expect(toggle).toBeVisible();

    const before = await page.locator("html").getAttribute("data-theme");
    await toggle.click();
    const after = await page.locator("html").getAttribute("data-theme");

    expect(before).not.toBe(after);

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", after ?? "dark");

    const iframe = page.locator("iframe[title='Dashboard preview']");
    await expect(iframe).toHaveAttribute("src", "/dashboard/");

    const frameStyle = await iframe.evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(frameStyle).toBe("none");

    await expect(page.locator("body")).not.toContainText(/cryptographically verified/i);
  });

  test("onboarding and employer filters are matrix-driven", async ({ page }) => {
    await page.goto("/onboarding");

    const trackSelect = page.locator("#careerPath");
    await expect(trackSelect).toBeVisible();
    const options = trackSelect.locator("option");
    await expect(options).toHaveCount(8);

    await page.goto("/employers/talent");
    const roleSelect = page.locator("select[name='role']");
    const toolSelect = page.locator("select[name='tool']");

    await expect(roleSelect).toBeVisible();
    await expect(toolSelect).toBeVisible();

    await expect(roleSelect).toContainText("Product Manager");
    await expect(toolSelect).toContainText("OpenAI API");
  });

  test("dashboard and fail-state copy are visible", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "My Projects" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Online Profile" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI Tutor Chat" })).toBeVisible();

    await page.goto("/dashboard/projects");
    await expect(page.getByText(/Fail state policy/i)).toBeVisible();
    await expect(page.getByText(/retry/i)).toBeVisible();

    await page.goto("/dashboard/updates");
    await expect(page.getByText(/Daily updates \+ relevant AI news module/i)).toBeVisible();

    const source = await page.content();
    expect(source.toLowerCase()).not.toContain("indigo-500");
    expect(source.toLowerCase()).not.toContain("purple-600");
  });
});
