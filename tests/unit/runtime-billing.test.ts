import { beforeEach, describe, expect, test } from "vitest";
import {
  runtimeFindUserById,
  runtimeGetBillingSubscription,
  runtimeGetOrCreateProfile,
  runtimeUpsertBillingSubscription,
} from "../../apps/web/lib/runtime";
import { resetStateForTests } from "../../packages/shared/src/store";

describe("runtime billing helpers", () => {
  beforeEach(() => {
    resetStateForTests();
  });

  test("creates or reuses a learner profile and stores billing state in memory mode", async () => {
    const profile = await runtimeGetOrCreateProfile({
      userId: "user_billing_001",
      name: "Billing Learner",
      email: "billing@example.com",
      handleBase: "billing-learner",
      avatarUrl: null,
    });

    expect(profile.id).toBe("user_billing_001");
    expect(await runtimeGetBillingSubscription(profile.id)).toBeNull();

    const saved = await runtimeUpsertBillingSubscription({
      userId: profile.id,
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_123",
      status: "trialing",
      trialEndsAt: "2026-03-26T12:00:00.000Z",
      currentPeriodEndsAt: "2026-03-26T12:00:00.000Z",
      cancelAtPeriodEnd: false,
      lastWebhookEventId: "evt_123",
      lastWebhookReceivedAt: "2026-03-19T12:00:00.000Z",
    });

    expect(saved.status).toBe("trialing");
    expect(saved.stripeCustomerId).toBe("cus_123");
    expect(await runtimeGetBillingSubscription(profile.id)).toMatchObject({
      stripeSubscriptionId: "sub_123",
      status: "trialing",
    });
    expect(await runtimeFindUserById(profile.id)).toMatchObject({
      stripeCustomerId: "cus_123",
    });
  });
});
