import { expect, test } from "@playwright/test";

const landingViewports = [
  { name: "desktop", width: 1440, height: 1100 },
  { name: "mobile", width: 390, height: 844 },
];

for (const viewport of landingViewports) {
  test(`landing header stays anchored on scroll (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");

    const header = page.locator("header").first();
    await expect(header).toBeVisible();

    const beforeScroll = await page.evaluate(() => {
      const headerEl = document.querySelector("header");
      const headingEl = document.querySelector("h1");

      if (!(headerEl instanceof HTMLElement) || !(headingEl instanceof HTMLElement)) {
        throw new Error("Expected landing header and hero heading to exist");
      }

      const headerBox = headerEl.getBoundingClientRect();
      const headingBox = headingEl.getBoundingClientRect();

      return {
        headerTop: headerBox.top,
        headerBottom: headerBox.bottom,
        headingTop: headingBox.top,
      };
    });

    expect(Math.abs(beforeScroll.headerTop)).toBeLessThanOrEqual(1);
    expect(beforeScroll.headingTop).toBeGreaterThanOrEqual(beforeScroll.headerBottom - 1);

    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(200);

    const afterScroll = await page.evaluate(() => {
      const headerEl = document.querySelector("header");
      const scrollY = window.scrollY;

      if (!(headerEl instanceof HTMLElement)) {
        throw new Error("Expected landing header to exist");
      }

      return {
        headerTop: headerEl.getBoundingClientRect().top,
        scrollY,
      };
    });

    expect(afterScroll.scrollY).toBeGreaterThan(100);
    expect(Math.abs(afterScroll.headerTop)).toBeLessThanOrEqual(1);
  });
}
