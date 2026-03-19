import { beforeEach, describe, expect, test } from "vitest";
import {
  getBillingSubscription,
  resetStateForTests,
  upsertBillingSubscription,
} from "../../packages/shared/src/store";

describe("billing store", () => {
  beforeEach(() => {
    resetStateForTests();
  });

  test("stores a learner billing subscription and trial state", () => {
    const saved = upsertBillingSubscription({
      userId: "user_test_0001",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_123",
      status: "trialing",
      trialEndsAt: "2026-03-26T12:00:00.000Z",
      currentPeriodEndsAt: "2026-03-26T12:00:00.000Z",
      cancelAtPeriodEnd: false,
    });

    expect(saved.status).toBe("trialing");
    expect(saved.stripeCustomerId).toBe("cus_123");
    expect(getBillingSubscription("user_test_0001")).toMatchObject({
      stripeSubscriptionId: "sub_123",
      status: "trialing",
    });
  });

  test("updates an existing learner billing subscription", () => {
    upsertBillingSubscription({
      userId: "user_test_0001",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_123",
      status: "trialing",
      trialEndsAt: "2026-03-26T12:00:00.000Z",
      currentPeriodEndsAt: "2026-03-26T12:00:00.000Z",
      cancelAtPeriodEnd: false,
    });

    const saved = upsertBillingSubscription({
      userId: "user_test_0001",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_123",
      status: "active",
      trialEndsAt: null,
      currentPeriodEndsAt: "2026-04-26T12:00:00.000Z",
      cancelAtPeriodEnd: true,
    });

    expect(saved.status).toBe("active");
    expect(saved.cancelAtPeriodEnd).toBe(true);
    expect(getBillingSubscription("user_test_0001")?.trialEndsAt).toBeNull();
  });
});
