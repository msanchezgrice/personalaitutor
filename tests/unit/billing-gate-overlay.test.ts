import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const billingGateOverlayPath = path.resolve(process.cwd(), "apps/web/components/billing-gate-overlay.tsx");

describe("billing gate overlay", () => {
  test("renders the approved trial messaging and actions", () => {
    const source = readFileSync(billingGateOverlayPath, "utf8");

    expect(source).toContain("Your dashboard is ready. Start your 7-day free trial");
    expect(source).toContain("Pay to unlock features including:");
    expect(source).toContain("Get career-related AI news sent to you daily");
    expect(source).toContain("Get suggested tweets that you can post to show your progress and your focus on AI");
    expect(source).toContain("Get dedicated AI skills modules based on your career");
    expect(source).toContain("Get a 24/7 dedicated AI tutor that can help with any questions");
    expect(source).toContain("Cancel anytime. Satisfaction guaranteed.");
    expect(source).toContain("Start 7-Day Free Trial");
    expect(source).toContain("Back to My Report");
    expect(source).toContain("Auto-renews at $49.99/month unless canceled before trial end.");
    expect(source).toContain("fixed inset-0");
    expect(source).toContain("returnToReport");
    expect(source).toContain("autoStart");
    expect(source).toContain("resumeEmailDeliveryId");
    expect(source).toContain("resumeEmailCampaignKey");
    expect(source).toContain("captureAnalyticsEvent(\"billing_checkout_started\"");
    expect(source).toContain("getOrCreateFunnelVisitorId()");
    expect(source).toContain("window.location.assign(returnToReport)");
    expect(source).toContain("mt-4 text-sm font-medium text-white");
    expect(source).toContain('data-billing-gate-heading="1"');
    expect(source).toContain('data-billing-gate-subcopy="1"');
    expect(source).toContain('data-billing-gate-footnote="1"');
    expect(source).toContain('data-billing-gate-error="1"');
  });
});
