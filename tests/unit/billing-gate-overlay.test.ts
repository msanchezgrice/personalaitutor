import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const billingGateOverlayPath = path.resolve(process.cwd(), "apps/web/components/billing-gate-overlay.tsx");

describe("billing gate overlay", () => {
  test("renders the approved trial messaging and actions", () => {
    const source = readFileSync(billingGateOverlayPath, "utf8");

    expect(source).toContain("Your dashboard is ready. Start your 7-day free trial");
    expect(source).toContain("Card required today. You will not be charged until your trial ends.");
    expect(source).toContain("Start 7-Day Free Trial");
    expect(source).toContain("Back to My Report");
    expect(source).toContain("Auto-renews at $49.99/month unless canceled before trial end.");
    expect(source).toContain("fixed inset-0");
    expect(source).toContain("returnToReport");
    expect(source).toContain("window.location.assign(returnToReport)");
    expect(source).toContain("mt-4 text-sm font-medium text-white");
  });
});
