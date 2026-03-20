import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const dashboardPagePath = path.resolve(process.cwd(), "apps/web/app/dashboard/page.tsx");
const billingGateOverlayPath = path.resolve(process.cwd(), "apps/web/components/billing-gate-overlay.tsx");

describe("billing reminder resume wiring", () => {
  test("threads reminder resume query params from the dashboard into the billing gate overlay", () => {
    const dashboardSource = readFileSync(dashboardPagePath, "utf8");
    const overlaySource = readFileSync(billingGateOverlayPath, "utf8");

    expect(dashboardSource).toContain("billing_resume");
    expect(dashboardSource).toContain("email_delivery_id");
    expect(dashboardSource).toContain("email_campaign_key");
    expect(dashboardSource).toContain("autoStart={autoStartBillingCheckout}");
    expect(dashboardSource).toContain("resumeEmailDeliveryId={resumeEmailDeliveryId}");
    expect(dashboardSource).toContain("resumeEmailCampaignKey=");

    expect(overlaySource).toContain("autoStart");
    expect(overlaySource).toContain("resumeEmailDeliveryId");
    expect(overlaySource).toContain("resumeEmailCampaignKey");
    expect(overlaySource).toContain("useEffect");
    expect(overlaySource).toContain("void handleCheckoutStart()");
  });
});
