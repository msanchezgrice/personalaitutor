import { describe, expect, test } from "vitest";
import { shouldPersistClientFunnelEvent } from "@/lib/funnel-events";

describe("funnel events", () => {
  test("persists the dashboard handoff and billing gate steps needed for the paid funnel", () => {
    expect(shouldPersistClientFunnelEvent("onboarding_continue_to_dashboard")).toBe(true);
    expect(shouldPersistClientFunnelEvent("billing_hard_gate_viewed")).toBe(true);
    expect(shouldPersistClientFunnelEvent("dashboard_signed_in_landed")).toBe(true);
  });

  test("persists the anonymous assessment funnel steps", () => {
    expect(shouldPersistClientFunnelEvent("anonymous_assessment_started")).toBe(true);
    expect(shouldPersistClientFunnelEvent("anonymous_assessment_completed")).toBe(true);
    expect(shouldPersistClientFunnelEvent("assessment_email_captured")).toBe(true);
    expect(shouldPersistClientFunnelEvent("assessment_report_viewed")).toBe(true);
  });

  test("keeps the pre-existing funnel events intact", () => {
    for (const event of [
      "landing_page_viewed",
      "landing_cta_clicked",
      "auth_sign_up_completed",
      "onboarding_viewed",
      "assessment_started",
      "assessment_completed",
      "onboarding_completed",
    ]) {
      expect(shouldPersistClientFunnelEvent(event)).toBe(true);
    }
  });
});
