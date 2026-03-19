import { describe, expect, test } from "vitest";
import {
  billingAccessAllowed,
  buildBillingGateRedirect,
  buildOnboardingReportReturnUrl,
  buildBillingSubscriptionRecord,
  buildCheckoutUrls,
  buildStripeCheckoutSessionParams,
  normalizeBillingStatus,
  sanitizeDashboardReturnTo,
  shouldRedirectBlockedDashboardPath,
  stripeTimestampToIso,
} from "../../apps/web/lib/billing";

describe("billing helpers", () => {
  test("only trialing and active subscriptions unlock access", () => {
    expect(billingAccessAllowed("trialing")).toBe(true);
    expect(billingAccessAllowed("active")).toBe(true);
    expect(billingAccessAllowed("canceled")).toBe(false);
    expect(billingAccessAllowed("past_due")).toBe(false);
    expect(billingAccessAllowed(null)).toBe(false);
  });

  test("normalizes unknown or missing statuses to none", () => {
    expect(normalizeBillingStatus(undefined)).toBe("none");
    expect(normalizeBillingStatus(null)).toBe("none");
    expect(normalizeBillingStatus("ACTIVE")).toBe("active");
    expect(normalizeBillingStatus("weird_status")).toBe("none");
  });

  test("builds gated dashboard redirect targets for blocked nested routes", () => {
    expect(buildBillingGateRedirect("/dashboard/chat")).toBe("/dashboard?billing=required&return_to=%2Fdashboard%2Fchat");
    expect(buildBillingGateRedirect("/dashboard/projects?foo=bar")).toBe(
      "/dashboard?billing=required&return_to=%2Fdashboard%2Fprojects%3Ffoo%3Dbar",
    );
  });

  test("sanitizes dashboard return targets to internal dashboard routes", () => {
    expect(sanitizeDashboardReturnTo("/dashboard/chat")).toBe("/dashboard/chat");
    expect(sanitizeDashboardReturnTo("https://evil.example")).toBe("/dashboard");
    expect(sanitizeDashboardReturnTo("/profile")).toBe("/dashboard");
    expect(sanitizeDashboardReturnTo(undefined)).toBe("/dashboard");
  });

  test("only blocked nested dashboard routes redirect to the billing gate", () => {
    expect(shouldRedirectBlockedDashboardPath("/dashboard", "trialing")).toBe(false);
    expect(shouldRedirectBlockedDashboardPath("/dashboard", "none")).toBe(false);
    expect(shouldRedirectBlockedDashboardPath("/dashboard/chat", "none")).toBe(true);
    expect(shouldRedirectBlockedDashboardPath("/dashboard/projects", "active")).toBe(false);
  });

  test("builds checkout return urls for dashboard trial start", () => {
    expect(
      buildCheckoutUrls({
        appUrl: "https://example.com",
        returnTo: "/dashboard/chat",
      }),
    ).toEqual({
      successUrl: "https://example.com/dashboard?billing=success&session_id={CHECKOUT_SESSION_ID}&return_to=%2Fdashboard%2Fchat",
      cancelUrl: "https://example.com/dashboard?billing=canceled&return_to=%2Fdashboard%2Fchat",
    });
  });

  test("builds a deterministic onboarding report return url", () => {
    expect(buildOnboardingReportReturnUrl("session_123")).toBe("/onboarding?view=report&sessionId=session_123");
    expect(buildOnboardingReportReturnUrl("")).toBe("/onboarding?view=report");
    expect(buildOnboardingReportReturnUrl(undefined)).toBe("/onboarding?view=report");
  });

  test("builds stripe checkout params for a 7 day trial subscription", () => {
    const params = buildStripeCheckoutSessionParams({
      priceId: "price_123",
      successUrl: "https://example.com/dashboard?billing=success",
      cancelUrl: "https://example.com/dashboard?billing=canceled",
      customerId: "cus_123",
      userId: "user_123",
      trialDays: 7,
    });

    expect(params.mode).toBe("subscription");
    expect(params.payment_method_collection).toBe("always");
    expect(params.line_items).toEqual([{ price: "price_123", quantity: 1 }]);
    expect(params.subscription_data?.trial_period_days).toBe(7);
    expect(params.customer).toBe("cus_123");
    expect(params.success_url).toContain("billing=success");
    expect(params.cancel_url).toContain("billing=canceled");
    expect(params.metadata).toMatchObject({ userId: "user_123" });
  });

  test("converts stripe timestamps into iso strings", () => {
    expect(stripeTimestampToIso(1_710_000_000)).toBe("2024-03-09T16:00:00.000Z");
    expect(stripeTimestampToIso(null)).toBeNull();
  });

  test("maps a stripe subscription into the stored billing record shape", () => {
    expect(
      buildBillingSubscriptionRecord({
        userId: "user_123",
        lastWebhookEventId: "evt_123",
        lastWebhookReceivedAt: "2026-03-19T18:00:00.000Z",
        subscription: {
          id: "sub_123",
          customer: "cus_123",
          status: "trialing",
          cancel_at_period_end: false,
          trial_end: 1_774_540_800,
          current_period_end: 1_774_540_800,
          items: {
            data: [{ price: { id: "price_123" } }],
          },
        },
      }),
    ).toEqual({
      userId: "user_123",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_123",
      status: "trialing",
      trialEndsAt: "2026-03-26T16:00:00.000Z",
      currentPeriodEndsAt: "2026-03-26T16:00:00.000Z",
      cancelAtPeriodEnd: false,
      lastWebhookEventId: "evt_123",
      lastWebhookReceivedAt: "2026-03-19T18:00:00.000Z",
    });
  });
});
