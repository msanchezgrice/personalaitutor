import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockGetAuthSeed,
  mockGetUserId,
  mockCreateStripeCheckoutSession,
  mockCreateStripePortalSession,
  mockConstructStripeWebhookEvent,
  mockHandleStripeWebhookEvent,
  mockRecordPersistedFunnelEvent,
} = vi.hoisted(() => ({
  mockGetAuthSeed: vi.fn(),
  mockGetUserId: vi.fn(),
  mockCreateStripeCheckoutSession: vi.fn(),
  mockCreateStripePortalSession: vi.fn(),
  mockConstructStripeWebhookEvent: vi.fn(),
  mockHandleStripeWebhookEvent: vi.fn(),
  mockRecordPersistedFunnelEvent: vi.fn(),
}));

class MockNextRequest extends Request {
  nextUrl: URL;

  constructor(input: string, init?: RequestInit) {
    super(input, init);
    this.nextUrl = new URL(input);
  }
}

vi.mock("next/server", () => ({
  NextRequest: MockNextRequest,
}), { virtual: true });

vi.mock("@/lib/auth", () => ({
  getAuthSeed: mockGetAuthSeed,
}));

vi.mock("@/lib/api", () => ({
  getUserId: mockGetUserId,
}));

vi.mock("@/lib/stripe-server", () => ({
  createStripeCheckoutSession: mockCreateStripeCheckoutSession,
  createStripePortalSession: mockCreateStripePortalSession,
  constructStripeWebhookEvent: mockConstructStripeWebhookEvent,
  handleStripeWebhookEvent: mockHandleStripeWebhookEvent,
}));

vi.mock("@/lib/funnel-events-server", () => ({
  recordPersistedFunnelEvent: mockRecordPersistedFunnelEvent,
}));

import { POST as checkoutPost } from "../../apps/web/app/api/billing/checkout/route";
import { POST as portalPost } from "../../apps/web/app/api/billing/portal/route";
import { POST as webhookPost } from "../../apps/web/app/api/billing/webhook/route";

describe("billing routes", () => {
  beforeEach(() => {
    mockGetAuthSeed.mockReset();
    mockGetUserId.mockReset();
    mockCreateStripeCheckoutSession.mockReset();
    mockCreateStripePortalSession.mockReset();
    mockConstructStripeWebhookEvent.mockReset();
    mockHandleStripeWebhookEvent.mockReset();
    mockRecordPersistedFunnelEvent.mockReset();
  });

  test("checkout rejects unauthenticated requests", async () => {
    mockGetAuthSeed.mockResolvedValue(null);
    mockGetUserId.mockReturnValue(null);

    const response = await checkoutPost(
      new MockNextRequest("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ returnTo: "/dashboard/chat" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  test("checkout returns a hosted stripe session url for authenticated users", async () => {
    mockGetAuthSeed.mockResolvedValue({
      userId: "user_123",
      name: "Billing User",
      email: "billing@example.com",
      avatarUrl: null,
      handleBase: "billing-user",
    });
    mockCreateStripeCheckoutSession.mockResolvedValue({
      profile: {
        id: "profile_123",
        acquisition: undefined,
      },
      session: {
        id: "cs_test_123",
        url: "https://checkout.stripe.com/pay/cs_test_123",
      },
    });

    const response = await checkoutPost(
      new MockNextRequest("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ returnTo: "/dashboard/chat" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.url).toBe("https://checkout.stripe.com/pay/cs_test_123");
    expect(mockCreateStripeCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        returnTo: "/dashboard/chat",
      }),
    );
  });

  test("checkout forwards reminder resume metadata when a billing reminder link restarts checkout", async () => {
    mockGetAuthSeed.mockResolvedValue({
      userId: "user_123",
      name: "Billing User",
      email: "billing@example.com",
      avatarUrl: null,
      handleBase: "billing-user",
    });
    mockCreateStripeCheckoutSession.mockResolvedValue({
      profile: {
        id: "profile_123",
        acquisition: undefined,
      },
      session: {
        id: "cs_test_resume_123",
        url: "https://checkout.stripe.com/pay/cs_test_resume_123",
      },
    });

    const response = await checkoutPost(
      new MockNextRequest("http://localhost/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          returnTo: "/dashboard/projects",
          resumeEmailDeliveryId: "delivery_123",
          resumeEmailCampaignKey: "billing_checkout_reminder_24h",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockCreateStripeCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        returnTo: "/dashboard/projects",
        resumeEmailDeliveryId: "delivery_123",
        resumeEmailCampaignKey: "billing_checkout_reminder_24h",
      }),
    );
  });

  test("portal returns a hosted customer portal url", async () => {
    mockGetAuthSeed.mockResolvedValue({
      userId: "user_123",
      name: "Billing User",
      email: "billing@example.com",
      avatarUrl: null,
      handleBase: "billing-user",
    });
    mockCreateStripePortalSession.mockResolvedValue({
      url: "https://billing.stripe.com/session/test_123",
    });

    const response = await portalPost(
      new MockNextRequest("http://localhost/api/billing/portal", {
        method: "POST",
        body: JSON.stringify({ returnTo: "/dashboard/profile" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.url).toBe("https://billing.stripe.com/session/test_123");
  });

  test("webhook rejects invalid signatures", async () => {
    mockConstructStripeWebhookEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });

    const response = await webhookPost(
      new MockNextRequest("http://localhost/api/billing/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "t=1,v1=bad",
        },
        body: "{}",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("STRIPE_WEBHOOK_INVALID");
  });

  test("webhook returns synced billing state when subscription sync succeeds", async () => {
    mockConstructStripeWebhookEvent.mockReturnValue({
      id: "evt_123",
      type: "customer.subscription.updated",
    });
    mockHandleStripeWebhookEvent.mockResolvedValue({
      status: "trialing",
    });

    const response = await webhookPost(
      new MockNextRequest("http://localhost/api/billing/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "t=1,v1=ok",
        },
        body: "{}",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.eventType).toBe("customer.subscription.updated");
    expect(body.syncedStatus).toBe("trialing");
  });
});
