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

  test("persists the career map and Proof Studio funnel steps", () => {
    for (const event of [
      "career_map_started",
      "career_map_completed",
      "career_map_failed",
      "career_map_viewed",
      "career_map_email_captured",
      "career_map_signup_clicked",
      "proof_site_published",
      "voice_model_tuned",
      "voice_model_published",
      "voice_model_public_run",
      "build_log_published",
      "remapped_route_viewed",
    ]) {
      expect(shouldPersistClientFunnelEvent(event)).toBe(true);
    }
  });

  test("ignores names outside the registered set", () => {
    expect(shouldPersistClientFunnelEvent("career_map_unknown")).toBe(false);
    expect(shouldPersistClientFunnelEvent("")).toBe(false);
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
