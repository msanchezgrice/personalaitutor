import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockRuntimeClaimStripeWebhookEvent,
  mockRuntimeGetBillingSubscription,
  mockRuntimeGetOrCreateProfile,
  mockRuntimeMarkStripeWebhookEventProcessed,
  mockRuntimeReleaseStripeWebhookEventClaim,
  mockRuntimeUpsertBillingSubscription,
} = vi.hoisted(() => ({
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
});
