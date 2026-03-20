import { describe, expect, test } from "vitest";
import { shouldPersistClientFunnelEvent } from "@/lib/funnel-events";

describe("funnel events", () => {
  test("persists the dashboard handoff and billing gate steps needed for the paid funnel", () => {
    expect(shouldPersistClientFunnelEvent("onboarding_continue_to_dashboard")).toBe(true);
    expect(shouldPersistClientFunnelEvent("billing_hard_gate_viewed")).toBe(true);
    expect(shouldPersistClientFunnelEvent("dashboard_signed_in_landed")).toBe(true);
  });
});
