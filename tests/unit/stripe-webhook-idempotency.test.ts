import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockRelayFirstPaidInvoiceConversion,
  mockRuntimeClaimStripeWebhookEvent,
  mockRuntimeGetBillingSubscription,
  mockRuntimeGetOrCreateProfile,
  mockRuntimeMarkStripeWebhookEventProcessed,
  mockRuntimeReleaseStripeWebhookEventClaim,
  mockRuntimeUpsertBillingSubscription,
} = vi.hoisted(() => ({
  mockRelayFirstPaidInvoiceConversion: vi.fn(),
  mockRuntimeClaimStripeWebhookEvent: vi.fn(),
  mockRuntimeGetBillingSubscription: vi.fn(),
  mockRuntimeGetOrCreateProfile: vi.fn(),
  mockRuntimeMarkStripeWebhookEventProcessed: vi.fn(),
  mockRuntimeReleaseStripeWebhookEventClaim: vi.fn(),
  mockRuntimeUpsertBillingSubscription: vi.fn(),
}));

vi.mock("@/lib/runtime", () => ({
  runtimeClaimStripeWebhookEvent: mockRuntimeClaimStripeWebhookEvent,
  runtimeGetBillingSubscription: mockRuntimeGetBillingSubscription,
  runtimeGetOrCreateProfile: mockRuntimeGetOrCreateProfile,
  runtimeMarkStripeWebhookEventProcessed: mockRuntimeMarkStripeWebhookEventProcessed,
  runtimeReleaseStripeWebhookEventClaim: mockRuntimeReleaseStripeWebhookEventClaim,
  runtimeUpsertBillingSubscription: mockRuntimeUpsertBillingSubscription,
}));

vi.mock("@/lib/billing-conversion-relay", () => ({
  relayFirstPaidInvoiceConversion: mockRelayFirstPaidInvoiceConversion,
}));

import { handleStripeWebhookEvent } from "../../apps/web/lib/stripe-server";

describe("stripe webhook idempotency", () => {
  const subscriptionEvent = {
    id: "evt_test_123",
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_test_123",
        customer: "cus_test_123",
        status: "trialing",
        cancel_at_period_end: false,
        trial_end: 1_710_000_000,
        current_period_end: 1_710_000_000,
        items: {
          data: [{ price: { id: "price_test_123" } }],
        },
        metadata: {
          userId: "user_123",
        },
      },
    },
  } as const;

  beforeEach(() => {
    mockRelayFirstPaidInvoiceConversion.mockReset();
    mockRuntimeClaimStripeWebhookEvent.mockReset();
    mockRuntimeGetBillingSubscription.mockReset();
    mockRuntimeGetOrCreateProfile.mockReset();
    mockRuntimeMarkStripeWebhookEventProcessed.mockReset();
    mockRuntimeReleaseStripeWebhookEventClaim.mockReset();
    mockRuntimeUpsertBillingSubscription.mockReset();
    mockRuntimeUpsertBillingSubscription.mockResolvedValue({
      userId: "user_123",
      stripeCustomerId: "cus_test_123",
      stripeSubscriptionId: "sub_test_123",
      stripePriceId: "price_test_123",
      status: "trialing",
      trialEndsAt: "2024-03-09T16:00:00.000Z",
      currentPeriodEndsAt: "2024-03-09T16:00:00.000Z",
      cancelAtPeriodEnd: false,
      lastWebhookEventId: "evt_test_123",
      lastWebhookReceivedAt: "2026-03-19T12:00:00.000Z",
      createdAt: "2026-03-19T12:00:00.000Z",
      updatedAt: "2026-03-19T12:00:00.000Z",
    });
  });

  test("skips duplicate webhook deliveries after the claim already exists", async () => {
    mockRuntimeClaimStripeWebhookEvent.mockResolvedValue(false);

    const result = await handleStripeWebhookEvent(subscriptionEvent as never);

    expect(result).toBeNull();
    expect(mockRuntimeUpsertBillingSubscription).not.toHaveBeenCalled();
    expect(mockRuntimeMarkStripeWebhookEventProcessed).not.toHaveBeenCalled();
    expect(mockRuntimeReleaseStripeWebhookEventClaim).not.toHaveBeenCalled();
  });

  test("marks a claimed webhook as processed after syncing billing", async () => {
    mockRuntimeClaimStripeWebhookEvent.mockResolvedValue(true);

    const result = await handleStripeWebhookEvent(subscriptionEvent as never);

    expect(result).toMatchObject({
      status: "trialing",
      stripeSubscriptionId: "sub_test_123",
    });
    expect(mockRuntimeUpsertBillingSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        stripeSubscriptionId: "sub_test_123",
        lastWebhookEventId: "evt_test_123",
      }),
    );
    expect(mockRuntimeMarkStripeWebhookEventProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "evt_test_123",
        userId: "user_123",
      }),
    );
    expect(mockRuntimeReleaseStripeWebhookEventClaim).not.toHaveBeenCalled();
  });

  test("releases the claim when webhook syncing fails", async () => {
    mockRuntimeClaimStripeWebhookEvent.mockResolvedValue(true);
    mockRuntimeUpsertBillingSubscription.mockRejectedValue(new Error("sync failed"));

    await expect(handleStripeWebhookEvent(subscriptionEvent as never)).rejects.toThrow("sync failed");

    expect(mockRuntimeReleaseStripeWebhookEventClaim).toHaveBeenCalledWith("evt_test_123");
    expect(mockRuntimeMarkStripeWebhookEventProcessed).not.toHaveBeenCalled();
  });

  test("relays the first paid invoice conversion when Stripe reports a successful paid invoice", async () => {
    mockRuntimeClaimStripeWebhookEvent.mockResolvedValue(true);
    mockRuntimeGetOrCreateProfile.mockResolvedValue({
      id: "user_123",
      contactEmail: "learner@example.com",
      acquisition: {
        first: {
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "brand_search",
          gclid: "gclid_test_123",
        },
      },
    });

    const invoiceEvent = {
      id: "evt_invoice_paid_123",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_test_123",
          status: "paid",
          amount_paid: 4999,
          currency: "usd",
          billing_reason: "subscription_cycle",
          parent: {
            type: "subscription_details",
            quote_details: null,
            subscription_details: {
              subscription: {
                id: "sub_test_123",
                customer: "cus_test_123",
                status: "active",
                cancel_at_period_end: false,
                trial_end: null,
                current_period_end: 1_710_000_000,
                items: {
                  data: [{ price: { id: "price_test_123" } }],
                },
                metadata: {
                  userId: "user_123",
                },
              },
              metadata: {
                userId: "user_123",
              },
            },
          },
          lines: {
            data: [],
          },
        },
      },
    } as const;

    await handleStripeWebhookEvent(invoiceEvent as never);

    expect(mockRelayFirstPaidInvoiceConversion).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        profile: expect.objectContaining({
          id: "user_123",
        }),
        invoice: expect.objectContaining({
          id: "in_test_123",
          amount_paid: 4999,
        }),
      }),
    );
    expect(mockRuntimeMarkStripeWebhookEventProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "evt_invoice_paid_123",
        userId: "user_123",
      }),
    );
  });
});
